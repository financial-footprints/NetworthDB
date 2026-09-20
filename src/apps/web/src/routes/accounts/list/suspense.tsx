import {
  Skeleton,
  SkeletonCircle,
  SkeletonStatus,
  SkeletonText,
} from "@web/components/Layout/Suspense/Skeleton";

function AccountCardSkeleton() {
  return (
    <div className="rounded-sm border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <SkeletonCircle size="sm" />
        <div className="space-y-2">
          <SkeletonText size="md" />
          <SkeletonText size="sm" />
        </div>
      </div>
      <Skeleton className="mt-4 h-7 w-40" />
    </div>
  );
}

export default function Loading() {
  return (
    <SkeletonStatus label="Loading Accounts">
      <div className="mx-auto w-full max-w-6xl">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AccountCardSkeleton />
          <AccountCardSkeleton />
          <AccountCardSkeleton />
        </div>
      </div>
    </SkeletonStatus>
  );
}
