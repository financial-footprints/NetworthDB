import { Skeleton, SkeletonStatus, SkeletonText } from "@web/components/Layout/Suspense/Skeleton";

function MonthCellSkeleton() {
  return (
    <div className="rounded-sm border border-slate-200 bg-white p-2">
      <SkeletonText size="sm" className="mx-auto h-3" />
      <div className="mt-2 flex justify-center gap-1">
        <Skeleton className="h-5 w-8 rounded-xs" />
        <Skeleton className="h-5 w-8 rounded-xs" />
      </div>
    </div>
  );
}

const SKELETON_MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
] as const;

export default function AccountStatementsLoading() {
  return (
    <SkeletonStatus label="Loading Account Statements">
      <div className="mx-auto w-full max-w-4xl">
        <SkeletonText size="md" className="mb-6 h-4" />

        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <SkeletonText size="xl" className="h-8 w-56" />
            <SkeletonText size="lg" className="h-5" />
          </div>
          <Skeleton className="h-9 w-24 rounded-sm" />
        </div>

        <div className="space-y-8">
          <div className="mt-6 space-y-3">
            <SkeletonText size="sm" className="h-4 w-36" />
            <Skeleton className="h-2.5 w-full rounded-full" />
            <div className="flex justify-between">
              <SkeletonText size="sm" className="h-3 w-20" />
              <SkeletonText size="sm" className="h-3 w-20" />
            </div>
          </div>

          <section>
            <SkeletonText size="md" className="mb-4 h-6 w-16" />
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {SKELETON_MONTHS.map((month) => (
                <MonthCellSkeleton key={month} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </SkeletonStatus>
  );
}
