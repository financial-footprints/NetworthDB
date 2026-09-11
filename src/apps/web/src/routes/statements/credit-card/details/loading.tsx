import { DetailsFieldSkeleton } from "@web/components/fields/DetailsFieldSkeleton";
import { Skeleton } from "@web/components/loading/Skeleton";
import { SkeletonStatus } from "@web/components/loading/SkeletonStatus";
import { SkeletonText } from "@web/components/loading/SkeletonText";
import { CREDIT_CARD_WIDTH } from "@web/routes/statements/credit-card/constants";

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

export default function CreditCardDetailsLoading() {
  return (
    <SkeletonStatus label="Loading credit card details">
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
          <section className="rounded-sm border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
              <div style={{ width: CREDIT_CARD_WIDTH }} className="shrink-0">
                <Skeleton className="aspect-[1.586/1] rounded-lg" />
              </div>
              <dl className="grid flex-1 gap-4 sm:grid-cols-2">
                <DetailsFieldSkeleton />
                <DetailsFieldSkeleton />
                <DetailsFieldSkeleton />
                <DetailsFieldSkeleton />
                <DetailsFieldSkeleton />
                <DetailsFieldSkeleton />
              </dl>
            </div>

            <div className="mt-8 border-t border-slate-200 pt-8">
              <DetailsFieldSkeleton />
              <div className="mt-6 space-y-3">
                <SkeletonText size="sm" className="h-4 w-36" />
                <Skeleton className="h-2.5 w-full rounded-full" />
                <div className="flex justify-between">
                  <SkeletonText size="sm" className="h-3 w-20" />
                  <SkeletonText size="sm" className="h-3 w-20" />
                </div>
              </div>
            </div>
          </section>

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
