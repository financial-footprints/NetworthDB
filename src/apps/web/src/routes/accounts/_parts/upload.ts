import type { NotificationVariant } from "@web/contexts/Notifications/Context";
import { runEnqueueJob } from "@web/utils/api/helpers";
import { uploadStatementFile } from "@web/utils/api/routes/accounts";
import type { StatementUploadParams } from "@web/utils/api/routes/accounts/types";
import { errorMessage } from "@web/utils/errors";
import { completeStatementJob, extractEnqueuedJobId } from "@web/utils/transactions";

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
    const enqueued = await runEnqueueJob({
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

    const jobId = extractEnqueuedJobId(enqueued);
    if (!jobId) {
      return;
    }

    try {
      await completeStatementJob(jobId, onUploadSuccess);
    } catch (error) {
      pushNotification(
        errorMessage(error, "Upload finished but the job did not complete."),
        "warning"
      );
      onUploadSuccess?.();
    }
  } finally {
    onBusyChange?.(false);
  }
}
