import { DetailsFieldSkeleton } from "@web/components/Fields/DetailsField";
import { Skeleton, SkeletonStatus, SkeletonText } from "@web/components/Layout/Suspense/Skeleton";
import { ACCOUNT_TILE_WIDTH } from "@web/utils/constants";

export default function AccountDetailsLoading() {
  return (
    <SkeletonStatus label="Loading Account Details">
      <div className="mx-auto w-full max-w-6xl">
        <SkeletonText size="md" className="mb-6 h-4" />

        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <SkeletonText size="xl" className="h-8 w-56" />
            <SkeletonText size="lg" className="h-5" />
          </div>
          <Skeleton className="h-9 w-24 rounded-sm" />
        </div>

        <div className="space-y-8">
          <section className="rounded-sm border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
              <div style={{ width: ACCOUNT_TILE_WIDTH }} className="shrink-0">
                <Skeleton className="aspect-[1.586/1] rounded-lg" />
              </div>
              <dl className="grid flex-1 gap-4 sm:grid-cols-2">
                <DetailsFieldSkeleton />
                <DetailsFieldSkeleton />
                <DetailsFieldSkeleton />
                <DetailsFieldSkeleton />
                <DetailsFieldSkeleton />
              </dl>
            </div>
          </section>
        </div>
      </div>
    </SkeletonStatus>
  );
}
