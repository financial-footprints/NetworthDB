import { Skeleton, SkeletonStatus } from "@web/components/Layout/Suspense/Skeleton";

export function CategoriesPageSkeleton() {
  return (
    <SkeletonStatus label="Loading Categories">
      <div className="space-y-3">
        <Skeleton className="h-10 w-full max-w-sm" />
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    </SkeletonStatus>
  );
}
