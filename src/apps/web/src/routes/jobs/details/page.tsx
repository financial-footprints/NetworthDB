import { PageBoundary } from "@web/components/Layout/PageBoundary";
import { JobDetailsContent } from "@web/routes/jobs/details/_parts/Content";
import { JobDetailsErrorFallback } from "@web/routes/jobs/details/error";
import Loading from "@web/routes/jobs/details/suspense";
import { invalidateJob } from "@web/utils/api/routes/jobs";
import { useState } from "react";
import { useParams } from "react-router-dom";

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
        <JobDetailsErrorFallback error={error} reset={reset} onRetry={retryFetch} />
      )}
    >
      <JobDetailsContent key={`${jobId}-${fetchKey}`} />
    </PageBoundary>
  );
}
