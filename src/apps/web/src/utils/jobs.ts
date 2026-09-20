import { fetchJob, isActiveJob } from "@web/utils/api/routes/jobs";
import type { JobApi } from "@web/utils/api/routes/jobs/types";

const JOB_POLL_INTERVAL_MS = 1000;
const JOB_WAIT_TIMEOUT_MS = 10 * 60 * 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export async function waitForJob(jobId: string, options?: { timeoutMs?: number }): Promise<JobApi> {
  const timeoutMs = options?.timeoutMs ?? JOB_WAIT_TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const job = await fetchJob(jobId);
    if (!isActiveJob(job)) {
      return job;
    }
    await sleep(JOB_POLL_INTERVAL_MS);
  }

  throw new Error("Timed out waiting for the job to finish.");
}
