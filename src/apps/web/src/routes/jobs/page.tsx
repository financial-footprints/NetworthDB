import { PageBoundary } from "@web/components/layout/PageBoundary";
import { PageHeading } from "@web/components/layout/PageHeading";
import { PageTitle } from "@web/components/layout/PageTitle";
import { JobsList } from "@web/routes/jobs/JobsList";
import Loading from "@web/routes/jobs/loading";
import { invalidateJobs } from "@web/utils/api/endpoints/jobs";

export default function JobsPage() {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageTitle page="Jobs" />
      <PageHeading
        title="Jobs"
        description="Status of sync and upload tasks running in the background."
      />

      <PageBoundary
        errorTitle="Could not load jobs"
        onRetry={() => {
          invalidateJobs();
        }}
        loadingFallback={<Loading />}
      >
        <JobsList />
      </PageBoundary>
    </div>
  );
}
