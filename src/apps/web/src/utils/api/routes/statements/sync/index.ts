import { API, jobCreatedSchema } from "@ndb/platform";
import { apiRequest } from "@web/utils/api/client";
import { readAccounts } from "@web/utils/api/routes/accounts";
import { withSessionToken } from "@web/utils/api/routes/auth";
import type { JobCreatedResponse } from "@web/utils/api/routes/jobs/types";
import { ApiError } from "@web/utils/api/types";

export type StatementSyncRequest = {
  accountId: string;
  financialYear?: string;
};

type EnqueueResult = {
  started: true;
  jobId: string;
};

type StartedSyncJob = {
  accountId: string;
  jobId: string;
};

type EnqueueAllResult = {
  started: number;
  conflicts: number;
  jobs: StartedSyncJob[];
};

function startStatementSync(body: StatementSyncRequest): Promise<JobCreatedResponse> {
  return withSessionToken((sessionToken) =>
    apiRequest(API.accounts.statements.sync, {
      method: "POST",
      sessionToken,
      body,
      schema: jobCreatedSchema,
    }).then((response) => response.data)
  );
}

export async function enqueueStatementSync(request: StatementSyncRequest): Promise<EnqueueResult> {
  try {
    const created = await startStatementSync(request);
    return { started: true, jobId: created.jobId };
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      throw new ApiError(409, "A sync job is already running.");
    }
    throw error;
  }
}

export async function enqueueAllAccountsSyncs(): Promise<EnqueueAllResult> {
  const [banks, creditCards] = await Promise.all([
    enqueueAllAccountSyncs("bank"),
    enqueueAllAccountSyncs("credit_card"),
  ]);
  return {
    started: banks.started + creditCards.started,
    conflicts: banks.conflicts + creditCards.conflicts,
    jobs: [...banks.jobs, ...creditCards.jobs],
  };
}

async function enqueueAllAccountSyncs(
  accountType: "credit_card" | "bank"
): Promise<EnqueueAllResult> {
  const { accounts } = await readAccounts({ account_type: accountType });

  const results = await Promise.all(
    accounts.map(async (account) => {
      try {
        const enqueued = await enqueueStatementSync({ accountId: account.id });
        return { kind: "started" as const, accountId: account.id, jobId: enqueued.jobId };
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          return { kind: "conflict" as const };
        }
        throw error;
      }
    })
  );

  const jobs = results
    .filter((result) => result.kind === "started")
    .map((result) => ({ accountId: result.accountId, jobId: result.jobId }));

  return {
    started: jobs.length,
    conflicts: results.filter((result) => result.kind === "conflict").length,
    jobs,
  };
}
