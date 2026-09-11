import { SkeletonText } from "@web/components/loading/SkeletonText";

export function DetailsFieldSkeleton() {
  return (
    <div>
      <SkeletonText size="sm" className="h-3" />
      <SkeletonText size="md" className="mt-2 h-4" />
    </div>
  );
}
