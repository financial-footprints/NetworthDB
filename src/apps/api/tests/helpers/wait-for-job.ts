import type { ApiServices } from "@ndb/bootstrap";
import { type JobOutput, type User, Username } from "@ndb/core";
import type { AuthTestServices } from "@tests/api/helpers/auth-services";

type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

type JobPollResponse = {
  id: string;
  status: string;
  error?: string | null;
  output: JobOutput;
};

type WaitForJobOptions = {
  wantStatus?: "completed" | "failed" | "cancelled";
  acceptStatuses?: Array<"completed" | "failed" | "cancelled">;
  timeoutMs?: number;
  intervalMs?: number;
};

const TERMINAL_STATUSES = new Set<JobStatus>(["completed", "failed", "cancelled"]);

function resolveAccepted(options: WaitForJobOptions): Set<JobStatus> {
  if (options.acceptStatuses) {
    return new Set(options.acceptStatuses);
  }

  if (options.wantStatus) {
    return new Set([options.wantStatus]);
  }

  return new Set(TERMINAL_STATUSES);
}

function terminalMismatch(job: JobPollResponse, wantStatus?: JobStatus): void {
  if (!wantStatus || !TERMINAL_STATUSES.has(job.status as JobStatus)) {
    return;
  }

  if (job.status !== wantStatus) {
    throw new Error(
      `Job ${job.id} ended with status ${job.status}${job.error ? `: ${job.error}` : ""}`
    );
  }
}

async function userForUsername(users: AuthTestServices["users"], username: string): Promise<User> {
  const matches = await users.findByFilters({ username: Username.parse(username) });
  const user = matches[0];
  if (!user) {
    throw new Error(`test user not found: ${username}`);
  }

  return user;
}

async function pollJob(
  readJob: () => Promise<JobPollResponse>,
  options: WaitForJobOptions
): Promise<JobPollResponse> {
  const accepted = resolveAccepted(options);
  const timeoutMs = options.timeoutMs ?? 3_000;
  const intervalMs = options.intervalMs ?? 10;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const job = await readJob();
    if (accepted.has(job.status as JobStatus)) {
      return job;
    }

    terminalMismatch(job, options.wantStatus);
    await Bun.sleep(intervalMs);
  }

  throw new Error(
    `Timed out waiting for job to reach [${[...accepted].join(", ")}] within ${timeoutMs}ms`
  );
}

export async function waitForJobInServices(
  services: Pick<ApiServices, "jobService"> & Pick<AuthTestServices, "users">,
  username: string,
  jobId: string,
  options: WaitForJobOptions = {}
): Promise<JobPollResponse> {
  const user = await userForUsername(services.users, username);

  return pollJob(async () => {
    const job = await services.jobService.get(user, "aal1", jobId);
    return {
      id: job.id,
      status: job.status,
      error: job.error,
      output: job.output,
    };
  }, options);
}
