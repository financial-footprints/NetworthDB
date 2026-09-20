import { PrimaryButton } from "@web/components/Button";
import { type NotificationVariant, useNotifications } from "@web/contexts/Notifications/Context";
import { useSubmit } from "@web/hooks/submit";
import { runEnqueueJob } from "@web/utils/api/helpers";
import { invalidateJobs } from "@web/utils/api/routes/jobs";
import {
  enqueueAllAccountsSyncs,
  enqueueStatementSync,
} from "@web/utils/api/routes/statements/sync";
import { ApiError } from "@web/utils/api/types";
import { errorMessage } from "@web/utils/errors";
import {
  completeStatementJob,
  completeStatementJobInBackground,
  extractEnqueuedJobId,
} from "@web/utils/transactions";
import { FaSync } from "react-icons/fa";

type PushNotification = (message: string, variant?: NotificationVariant) => void;

function notifyBulkSyncOutcome(options: {
  started: number;
  conflicts: number;
  jobs: Array<{ jobId: string }>;
  emptyLabel: string;
  pushNotification: PushNotification;
}): void {
  const { started, conflicts, jobs, emptyLabel, pushNotification } = options;
  if (started > 0) {
    pushNotification("Your sync job is in progress.");
    invalidateJobs();
    for (const job of jobs) {
      completeStatementJobInBackground(job.jobId);
    }
    return;
  }
  if (conflicts > 0) {
    pushNotification("A sync job is already running.", "warning");
    return;
  }
  pushNotification(`No ${emptyLabel} to sync.`, "warning");
}

function notifyBulkSyncError(error: unknown, pushNotification: PushNotification): void {
  if (error instanceof ApiError && error.status === 409) {
    pushNotification("A sync job is already running.", "warning");
    return;
  }
  pushNotification(errorMessage(error, "Sync failed"), "error");
}

type SyncButtonProps =
  | { scope: "all_accounts" }
  | {
      scope: "account";
      accountId: string;
      onSyncSettled?: () => void;
    };

export function SyncButton(props: SyncButtonProps) {
  const { pushNotification } = useNotifications();
  const { isSubmitting, run } = useSubmit();

  async function handleSyncAllAccounts(): Promise<void> {
    try {
      const { started, conflicts, jobs } = await enqueueAllAccountsSyncs();
      notifyBulkSyncOutcome({
        started,
        conflicts,
        jobs,
        emptyLabel: "accounts",
        pushNotification,
      });
    } catch (error) {
      notifyBulkSyncError(error, pushNotification);
    }
  }

  return (
    <PrimaryButton
      onClick={() => {
        if (props.scope === "all_accounts") {
          void run(() => handleSyncAllAccounts());
          return;
        }
        void run(async () => {
          const enqueued = await runEnqueueJob({
            action: () => enqueueStatementSync({ accountId: props.accountId }),
            pushNotification,
            successMessage: "Your sync job is in progress.",
            conflictMessage: "A sync job is already running.",
            failureFallback: "Sync failed",
          });
          const jobId = extractEnqueuedJobId(enqueued);
          if (!jobId) {
            return;
          }
          try {
            await completeStatementJob(jobId, props.onSyncSettled);
          } catch (error) {
            pushNotification(
              errorMessage(error, "Sync finished but the job did not complete."),
              "warning"
            );
            props.onSyncSettled?.();
          }
        });
      }}
      aria-busy={isSubmitting}
    >
      <FaSync className="h-4 w-4 shrink-0" aria-hidden />
      Sync
    </PrimaryButton>
  );
}
