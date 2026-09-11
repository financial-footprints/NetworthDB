/**
 * Poll GET /api/v1/jobs/:id until a terminal or expected status is reached.
 *
 * Usage in script:pre-request:
 *   const { waitForJob } = require("./lib/bruno-jobs/wait-for-job.cjs");
 *   await waitForJob({ baseUrl, token, jobId, wantStatus: "completed" });
 */

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForJob({
  baseUrl,
  token,
  jobId,
  wantStatus,
  acceptStatuses,
  timeoutMs = 15000,
  intervalMs = 100,
}) {
  if (!baseUrl || !token || !jobId) {
    throw new Error("waitForJob requires baseUrl, token, and jobId");
  }

  const terminal = new Set(["completed", "failed", "cancelled"]);
  const accepted = acceptStatuses ?? (wantStatus ? [wantStatus] : [...terminal]);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const response = await fetch(`${baseUrl}/api/v1/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error(`jobs poll failed: HTTP ${response.status}`);
    }

    const body = await response.json();
    const status = body?.data?.status;
    if (accepted.includes(status)) {
      return body;
    }

    await sleep(intervalMs);
  }

  throw new Error(
    `Timed out waiting for job ${jobId} to reach [${accepted.join(", ")}] within ${timeoutMs}ms`
  );
}

module.exports = { waitForJob };
