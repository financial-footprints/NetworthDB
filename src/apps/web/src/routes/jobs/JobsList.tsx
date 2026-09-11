import completedTasksIllustration from "@web/assets/images/illustrations/completed-tasks.svg";
import { DangerButton } from "@web/components/button";
import { StatusView } from "@web/components/layout/StatusView";
import { useNotifications } from "@web/context/Notifications/NotificationContext";
import { usePollingWhileActive } from "@web/hooks/usePollingWhileActive";
import { path } from "@web/router/routes";
import { useCancelJob, useJobAccountIndex } from "@web/routes/jobs/hooks";
import { JobRow } from "@web/routes/jobs/JobRow";
import {
  cacheJobs,
  cancelAllJobs,
  isActiveJob,
  loadJobs,
  useJobs,
} from "@web/utils/api/endpoints/jobs";
import type { JobResponse } from "@web/utils/api/endpoints/jobs/types";
import { POLL_INTERVAL_MS } from "@web/utils/constant";
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

function sortJobsNewestFirst(jobs: JobResponse[]): JobResponse[] {
  return [...jobs].sort(
    (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  );
}

export function JobsList() {
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
    const data = await loadJobs();
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
    await cancelJobById(jobId, (updated: JobResponse) => {
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
          <JobRow
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
