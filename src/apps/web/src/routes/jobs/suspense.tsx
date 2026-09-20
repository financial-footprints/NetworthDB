import { Skeleton, SkeletonStatus, SkeletonText } from "@web/components/Layout/Suspense/Skeleton";

function JobRowSkeleton() {
  return (
    <div className="rounded-sm border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-4">
        <Skeleton className="h-10 w-10 shrink-0 rounded-sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SkeletonText size="lg" className="h-5" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <SkeletonText size="xl" className="mt-2 h-4" />
        </div>
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <SkeletonStatus label="Loading Jobs">
      <div className="space-y-3">
        <JobRowSkeleton />
        <JobRowSkeleton />
        <JobRowSkeleton />
        <JobRowSkeleton />
        <JobRowSkeleton />
      </div>
    </SkeletonStatus>
  );
}
