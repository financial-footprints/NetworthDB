import { DetailsFieldSkeleton } from "@web/components/fields/DetailsFieldSkeleton";
import { Skeleton } from "@web/components/loading/Skeleton";
import { SkeletonStatus } from "@web/components/loading/SkeletonStatus";
import { SkeletonText } from "@web/components/loading/SkeletonText";

export default function Loading() {
  return (
    <SkeletonStatus label="Loading job details">
      <div className="mx-auto w-full max-w-4xl">
        <SkeletonText size="md" className="mb-6 h-4" />

        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-3">
            <SkeletonText size="xl" className="h-8 w-56" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-14 rounded-full" />
          </div>
          <SkeletonText size="lg" className="mt-2 h-5 w-40" />
        </div>

        <section className="rounded-sm border border-slate-200 bg-white p-6 shadow-sm">
          <dl className="grid gap-4 sm:grid-cols-2">
            <DetailsFieldSkeleton />
            <DetailsFieldSkeleton />
            <DetailsFieldSkeleton />
            <DetailsFieldSkeleton />
            <DetailsFieldSkeleton />
            <DetailsFieldSkeleton />
          </dl>
        </section>
      </div>
    </SkeletonStatus>
  );
}
