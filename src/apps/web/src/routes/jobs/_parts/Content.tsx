import completedTasksIllustration from "@web/assets/images/illustrations/completed-tasks.svg";
import { DangerButton } from "@web/components/Button";
import { StatusView } from "@web/components/Layout/StatusView";
import { useNotifications } from "@web/contexts/Notifications/Context";
import { usePollingWhileActive } from "@web/hooks/polling";
import { path } from "@web/router/routes";
import { useCancelJob, useJobAccountIndex } from "@web/routes/jobs/hooks";
import { Row } from "@web/routes/jobs/Row";
import {
  cacheJobs,
  cancelAllJobs,
  fetchJobs,
  isActiveJob,
  useJobs,
} from "@web/utils/api/routes/jobs";
import type { JobApi } from "@web/utils/api/routes/jobs/types";
import { POLL_INTERVAL_MS } from "@web/utils/constants";
import { errorMessage } from "@web/utils/errors";
import { useCallback, useEffect, useState } from "react";

function JobsListActions({
  hasActiveJobs,
  stoppingAll,
  onStopAll,
}: {
  hasActiveJobs: boolean;
  stoppingAll: boolean;
  onStopAll: () => void;
}) {
  if (!hasActiveJobs) {
    return null;
  }

  return (
    <div className="mb-6 flex justify-end">
      <DangerButton disabled={stoppingAll} onClick={onStopAll}>
        {stoppingAll ? "Stopping all…" : "Stop all"}
      </DangerButton>
    </div>
  );
}

function sortJobsNewestFirst(jobs: JobApi[]): JobApi[] {
  return [...jobs].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );
}

export function List() {
  const { pushNotification } = useNotifications();
  const { items: cachedJobs } = useJobs();
  const { cancelJobById, stoppingJobId } = useCancelJob();

  const [jobs, setJobs] = useState(() => sortJobsNewestFirst(cachedJobs));
  const accountIndex = useJobAccountIndex(jobs);
  const [stoppingAll, setStoppingAll] = useState(false);
  const hasActiveJobs = jobs.some(isActiveJob);

  useEffect(() => {
    setJobs(sortJobsNewestFirst(cachedJobs));
  }, [cachedJobs]);

  const pollJobs = useCallback(async () => {
    const data = await fetchJobs();
    cacheJobs(data);
    setJobs(sortJobsNewestFirst(data.items));
  }, []);

  usePollingWhileActive({
    isActive: hasActiveJobs,
    intervalMs: POLL_INTERVAL_MS,
    poll: pollJobs,
    failedEventId: "@ndb/web.jobs.poll.failed",
    path: path.jobs.list,
  });

  async function refreshJobs(): Promise<void> {
    await pollJobs();
  }

  async function handleStopJob(jobId: string): Promise<void> {
    await cancelJobById(jobId, (updated: JobApi) => {
      setJobs((prev) => sortJobsNewestFirst(prev.map((job) => (job.id === jobId ? updated : job))));
    });
  }

  async function handleStopAll(): Promise<void> {
    if (!window.confirm("Stop all running jobs?")) {
      return;
    }

    setStoppingAll(true);
    try {
      await cancelAllJobs();
      await refreshJobs();
    } catch (error) {
      pushNotification(errorMessage(error, "Failed to stop all jobs."), "error");
    } finally {
      setStoppingAll(false);
    }
  }

  if (jobs.length === 0) {
    return (
      <StatusView
        illustration={completedTasksIllustration}
        title="No jobs yet"
        message="Jobs appear here when you sync a card, sync all cards, or upload a statement."
      />
    );
  }

  return (
    <>
      <JobsListActions
        hasActiveJobs={hasActiveJobs}
        stoppingAll={stoppingAll}
        onStopAll={() => {
          void handleStopAll();
        }}
      />
      <div className="space-y-3">
        {jobs.map((job) => (
          <Row
            key={job.id}
            job={job}
            accountIndex={accountIndex}
            onStop={hasActiveJobs ? handleStopJob : undefined}
            stoppingJobId={stoppingJobId}
          />
        ))}
      </div>
    </>
  );
}
