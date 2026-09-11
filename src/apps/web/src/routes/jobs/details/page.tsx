import { DangerButton } from "@web/components/button";
import { createResourceErrorFallback } from "@web/components/error/ResourceErrorFallbackFactory";
import { PageBoundary } from "@web/components/layout/PageBoundary";
import { PageTitle } from "@web/components/layout/PageTitle";
import { usePollingWhileActive } from "@web/hooks/usePollingWhileActive";
import { path } from "@web/router/routes";
import { JobDetailsView } from "@web/routes/jobs/details/JobDetailsView";
import Loading from "@web/routes/jobs/details/loading";
import { resolveJobDisplay } from "@web/routes/jobs/display";
import { useCancelJob, useJobAccountIndex } from "@web/routes/jobs/hooks";
import { JobStatusBadges } from "@web/routes/jobs/JobStatusBadges";
import {
  cacheJob,
  invalidateJob,
  isActiveJob,
  loadJob,
  readJob,
} from "@web/utils/api/endpoints/jobs";
import { POLL_INTERVAL_MS } from "@web/utils/constant";
import { formatRelativeTime } from "@web/utils/time";
import { use, useCallback, useState } from "react";
import { FaArrowLeft } from "react-icons/fa";
import { Link, useParams } from "react-router-dom";

const DetailsErrorFallback = createResourceErrorFallback({
  notFoundTitle: "Job not found",
  notFoundMessage: "This job does not exist or is no longer available.",
  backTo: path.jobs.list,
  backLabel: "Back",
  errorTitle: "Could not load job",
});

function JobDetailsContent() {
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
    const data = await loadJob(jobId);
    cacheJob(data);
    setJob(data);
  }, [jobId]);

  usePollingWhileActive({
    isActive,
    intervalMs: POLL_INTERVAL_MS,
    poll: pollJob,
    failedEventId: "@ndb/web.jobs.poll.failed",
    path: path.jobs.get(jobId),
  });

  const display = resolveJobDisplay(job, accountIndex);
  const metaLine = formatRelativeTime(job.created_at);
  const creditCardAccount =
    display.account?.account_type === "credit_card" ? display.account : null;

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
            <JobStatusBadges job={job} typeLabel={display.typeLabel} />
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

      <JobDetailsView
        job={job}
        viewCardHref={
          creditCardAccount ? path.statements.credit_card.get(creditCardAccount.id) : undefined
        }
      />
    </div>
  );
}

export default function JobDetailsPage() {
  const { jobId } = useParams();
  const [fetchKey, setFetchKey] = useState(0);

  function retryFetch(): void {
    if (jobId) {
      invalidateJob(jobId);
    }
    setFetchKey((key) => key + 1);
  }

  return (
    <PageBoundary
      errorTitle="Could not load job"
      onRetry={retryFetch}
      loadingFallback={<Loading />}
      errorFallback={({ error, reset }) => (
        <DetailsErrorFallback error={error} reset={reset} onRetry={retryFetch} />
      )}
    >
      <JobDetailsContent key={`${jobId}-${fetchKey}`} />
    </PageBoundary>
  );
}
