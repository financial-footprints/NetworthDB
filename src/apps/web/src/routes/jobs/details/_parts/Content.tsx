import { DangerButton } from "@web/components/Button";
import { PageTitle } from "@web/components/Layout/PageTitle";
import { usePollingWhileActive } from "@web/hooks/polling";
import { path } from "@web/router/routes";
import { Badges } from "@web/routes/jobs/Badges";
import {
  BackupOutput,
  JobError,
  Logs,
  RulesOutput,
  Summary,
  Warnings,
} from "@web/routes/jobs/details/Sections";
import { resolveJobDisplay } from "@web/routes/jobs/display";
import { useCancelJob, useJobAccountIndex } from "@web/routes/jobs/hooks";
import { cacheJob, fetchJob, isActiveJob, readJob } from "@web/utils/api/routes/jobs";
import { POLL_INTERVAL_MS } from "@web/utils/constants";
import { formatRelativeTime } from "@web/utils/time";
import { use, useCallback, useState } from "react";
import { FaArrowLeft } from "react-icons/fa";
import { Link, useParams } from "react-router-dom";

export function JobDetailsContent() {
  const { jobId: routeJobId } = useParams();
  if (!routeJobId) {
    throw new Error("Missing job route parameter.");
  }
  const jobId = routeJobId;

  const initialJob = use(readJob(jobId));
  const [job, setJob] = useState(initialJob);
  const accountIndex = useJobAccountIndex([job]);
  const { cancelJobById, stoppingJobId } = useCancelJob();

  const isActive = isActiveJob(job);

  const pollJob = useCallback(async () => {
    const data = await fetchJob(jobId);
    cacheJob(data);
    setJob(data);
  }, [jobId]);

  usePollingWhileActive({
    isActive,
    intervalMs: POLL_INTERVAL_MS,
    poll: pollJob,
    failedEventId: "@ndb/web.jobs.poll.failed",
    path: path.jobs.details(jobId),
  });

  const display = resolveJobDisplay(job, accountIndex);
  const metaLine = formatRelativeTime(job.createdAt);
  const linkedAccount = display.account;
  const viewAccountHref = linkedAccount ? path.accounts.details(linkedAccount.id) : undefined;

  async function handleStop(): Promise<void> {
    await cancelJobById(jobId, setJob);
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageTitle page={display.title} />
      <Link
        to={path.jobs.list}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
      >
        <FaArrowLeft aria-hidden />
        Back
      </Link>

      <div className="mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold text-slate-900">{display.title}</h2>
            {metaLine ? (
              <p className="mt-2 text-base leading-relaxed text-slate-500">{metaLine}</p>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Badges job={job} typeLabel={display.typeLabel} />
            {isActive ? (
              <DangerButton
                disabled={stoppingJobId === jobId}
                onClick={() => {
                  void handleStop();
                }}
              >
                {stoppingJobId === jobId ? "Stopping…" : "Stop"}
              </DangerButton>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <Summary job={job} viewAccountHref={viewAccountHref} />
        {job.output.rules ? <RulesOutput rules={job.output.rules} /> : null}
        {job.output.backup ? <BackupOutput backup={job.output.backup} /> : null}
        <Warnings warnings={job.output.warnings} />
        <Logs logs={job.logs} active={isActive} />
        <JobError error={job.error} />
      </div>
    </div>
  );
}
