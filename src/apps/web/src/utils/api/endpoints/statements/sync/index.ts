import { API } from "@ndb/platform";
import { post } from "@web/utils/api/client";
import { readAccounts } from "@web/utils/api/endpoints/accounts";
import { withSessionToken } from "@web/utils/api/endpoints/auth";
import type { JobCreatedResponse } from "@web/utils/api/endpoints/jobs/types";
import type {
  StatementSyncRequest,
  StatementSyncScope,
} from "@web/utils/api/endpoints/statements/sync/types";
import { ApiError } from "@web/utils/api/types";

type EnqueueResult = {
  started: true;
  job_id: string;
};

type EnqueueAllResult = {
  started: number;
  conflicts: number;
};

function startStatementSync(body?: StatementSyncRequest): Promise<JobCreatedResponse> {
  return withSessionToken((sessionToken) =>
    post<JobCreatedResponse>(API.accounts.statements.sync, body ?? { scope: {} }, {
      sessionToken: sessionToken,
    }).then((response) => response.data)
  );
}

export async function enqueueStatementSync(scope?: StatementSyncScope): Promise<EnqueueResult> {
  const body: StatementSyncRequest = scope ? { scope } : { scope: {} };

  try {
    const created = await startStatementSync(body);
    return { started: true, job_id: created.id };
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      throw new ApiError(409, "A sync job is already running.");
    }
    throw error;
  }
}

export async function enqueueAllCreditCardSyncs(): Promise<EnqueueAllResult> {
  const { accounts } = await readAccounts("credit_card");

  const results = await Promise.all(
    accounts.map(async (account) => {
      try {
        await enqueueStatementSync({ account_id: account.id });
        return "started" as const;
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          return "conflict" as const;
        }
        throw error;
      }
    })
  );

  return {
    started: results.filter((result) => result === "started").length,
    conflicts: results.filter((result) => result === "conflict").length,
  };
}
