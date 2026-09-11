import { useNotifications } from "@web/context/Notifications/NotificationContext";
import { log } from "@web/logging";
import { buildAccountIndex, mergeAccountLists } from "@web/routes/jobs/display";
import { readAccounts } from "@web/utils/api/endpoints/accounts";
import type { Account } from "@web/utils/api/endpoints/accounts/types";
import { cancelJob } from "@web/utils/api/endpoints/jobs";
import type { JobResponse } from "@web/utils/api/endpoints/jobs/types";
import { errorMessage } from "@web/utils/errors";
import { useEffect, useMemo, useState } from "react";

type UseCancelJobResult = {
  cancelJobById: (jobId: string, onSuccess?: (updated: JobResponse) => void) => Promise<void>;
  stoppingJobId: string | null;
};

export function useJobAccountIndex(jobs: JobResponse[]): Map<string, Account> {
  const [accountIndex, setAccountIndex] = useState<Map<string, Account>>(() => new Map());

  const accountIds = useMemo(() => {
    const ids = new Set<string>();
    for (const job of jobs) {
      if (job.account_id) {
        ids.add(job.account_id);
      }
    }
    return ids;
  }, [jobs]);

  useEffect(() => {
    if (accountIds.size === 0) {
      setAccountIndex(new Map());
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const creditCards = await readAccounts("credit_card");
        let accounts = creditCards.accounts;
        const index = buildAccountIndex(accounts);
        const needsBankAccounts = [...accountIds].some((id) => !index.has(id));

        if (needsBankAccounts) {
          const bankAccounts = await readAccounts("bank_account");
          accounts = mergeAccountLists(creditCards, bankAccounts);
        }

        if (!cancelled) {
          setAccountIndex(buildAccountIndex(accounts));
        }
      } catch (error: unknown) {
        const kind = error instanceof Error ? error.name : "Error";
        log("warn", "@ndb/web.jobs.accounts.failed", { kind });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accountIds]);

  return accountIndex;
}

export function useCancelJob(): UseCancelJobResult {
  const { pushNotification } = useNotifications();
  const [stoppingJobId, setStoppingJobId] = useState<string | null>(null);

  const cancelJobById: UseCancelJobResult["cancelJobById"] = async (jobId, onSuccess) => {
    setStoppingJobId(jobId);
    try {
      const updated = await cancelJob(jobId);
      onSuccess?.(updated);
    } catch (error) {
      pushNotification(errorMessage(error, "Failed to stop job."), "error");
    } finally {
      setStoppingJobId(null);
    }
  };

  return { cancelJobById, stoppingJobId };
}
