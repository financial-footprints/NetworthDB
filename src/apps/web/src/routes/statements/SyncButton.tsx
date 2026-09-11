import { PrimaryButton } from "@web/components/button";
import { useNotifications } from "@web/context/Notifications/NotificationContext";
import { useSubmit } from "@web/hooks/useSubmit";
import { invalidateJobs } from "@web/utils/api/endpoints/jobs";
import {
  enqueueAllCreditCardSyncs,
  enqueueStatementSync,
} from "@web/utils/api/endpoints/statements/sync";
import { runEnqueueJob } from "@web/utils/api/helpers";
import { ApiError } from "@web/utils/api/types";
import { errorMessage } from "@web/utils/errors";
import { FaSync } from "react-icons/fa";

type SyncButtonProps =
  | { scope: "all_credit_cards" }
  | {
      scope: "account";
      accountId: string;
    };

export function SyncButton(props: SyncButtonProps) {
  const { pushNotification } = useNotifications();
  const { isSubmitting, run } = useSubmit();

  async function handleBulkClick(): Promise<void> {
    try {
      const { started, conflicts } = await enqueueAllCreditCardSyncs();

      if (started > 0) {
        pushNotification("Your sync job is in progress.");
        invalidateJobs();
      } else if (conflicts > 0) {
        pushNotification("A sync job is already running.", "warning");
      } else {
        pushNotification("No credit cards to sync.", "warning");
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        pushNotification("A sync job is already running.", "warning");
      } else {
        pushNotification(errorMessage(error, "Sync failed"), "error");
      }
    }
  }

  return (
    <PrimaryButton
      onClick={() => {
        if (props.scope === "all_credit_cards") {
          void run(handleBulkClick);
          return;
        }
        void run(() =>
          runEnqueueJob({
            action: () => enqueueStatementSync({ account_id: props.accountId }),
            pushNotification,
            successMessage: "Your sync job is in progress.",
            conflictMessage: "A sync job is already running.",
            failureFallback: "Sync failed",
          })
        );
      }}
      aria-busy={isSubmitting}
    >
      <FaSync className="h-4 w-4 shrink-0" aria-hidden />
      Sync
    </PrimaryButton>
  );
}
