import { Skeleton, SkeletonStatus } from "@web/components/Layout/Suspense/Skeleton";

export function RulesPageSkeleton() {
  return (
    <SkeletonStatus label="Loading Rules">
      <div className="space-y-3">
        <Skeleton className="h-10 w-full max-w-sm" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    </SkeletonStatus>
  );
}
