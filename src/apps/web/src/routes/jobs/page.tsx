import { PageBoundary } from "@web/components/Layout/PageBoundary";
import { PageHeading } from "@web/components/Layout/PageHeading";
import { PageTitle } from "@web/components/Layout/PageTitle";
import { List } from "@web/routes/jobs/_parts/Content";
import Loading from "@web/routes/jobs/suspense";
import { invalidateJobs } from "@web/utils/api/routes/jobs";

export default function JobsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl">
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
        <List />
      </PageBoundary>
    </div>
  );
}
