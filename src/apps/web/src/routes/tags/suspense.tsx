import { Skeleton, SkeletonStatus } from "@web/components/Layout/Suspense/Skeleton";

export function TagsPageSkeleton() {
  return (
    <SkeletonStatus label="Loading Tags">
      <div className="space-y-3">
        <Skeleton className="h-10 w-full max-w-sm" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    </SkeletonStatus>
  );
}
