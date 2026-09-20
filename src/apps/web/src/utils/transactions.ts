import { waitForJob } from "@web/utils/jobs";

export function extractEnqueuedJobId(result: unknown): string | undefined {
  if (!result || typeof result !== "object") {
    return undefined;
  }
  if ("jobId" in result && typeof result.jobId === "string") {
    return result.jobId;
  }
  return undefined;
}

export async function completeStatementJob(jobId: string, onSettled?: () => void): Promise<void> {
  const job = await waitForJob(jobId);
  if (job.status !== "completed") {
    return;
  }

  onSettled?.();
}

export function completeStatementJobInBackground(jobId: string, onSettled?: () => void): void {
  void completeStatementJob(jobId, onSettled).catch(() => {
    // Account pages refresh on next visit if the job waiter times out.
  });
}
