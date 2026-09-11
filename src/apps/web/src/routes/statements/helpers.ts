import type { NotificationVariant } from "@web/context/Notifications/NotificationContext";
import { uploadStatementFile } from "@web/utils/api/endpoints/accounts";
import type { StatementUploadParams } from "@web/utils/api/endpoints/accounts/types";
import { runEnqueueJob } from "@web/utils/api/helpers";

type SubmitStatementUploadParams = {
  accountId: string;
  request: Omit<StatementUploadParams, "accountId">;
  onUploadSuccess?: () => void;
  pushNotification: (message: string, variant?: NotificationVariant) => void;
  onBusyChange?: (busy: boolean) => void;
};

export async function submitStatementUpload({
  accountId,
  request,
  onUploadSuccess,
  pushNotification,
  onBusyChange,
}: SubmitStatementUploadParams): Promise<void> {
  onBusyChange?.(true);

  try {
    await runEnqueueJob({
      action: () =>
        uploadStatementFile({
          accountId,
          ...request,
        }),
      pushNotification,
      successMessage: "Your upload job is in progress.",
      conflictMessage: "An upload is already in progress for this account.",
      failureFallback: "Upload failed",
    });
    onUploadSuccess?.();
  } finally {
    onBusyChange?.(false);
  }
}
