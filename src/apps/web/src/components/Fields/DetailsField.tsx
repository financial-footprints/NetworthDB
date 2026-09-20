import { SkeletonText } from "@web/components/Layout/Suspense/Skeleton";

type DetailsFieldProps = {
  label: string;
  value: string;
  muted?: boolean;
};

export function DetailsField({ label, value, muted = false }: DetailsFieldProps) {
  return (
    <div className="space-y-0.5">
      <dt className="text-sm text-slate-400">{label}</dt>
      <dd
        className={
          muted
            ? "break-all font-mono text-xs text-slate-400"
            : "break-all text-sm font-medium text-slate-900"
        }
      >
        {value}
      </dd>
    </div>
  );
}

export function DetailsFieldSkeleton() {
  return (
    <div>
      <SkeletonText size="sm" className="h-3" />
      <SkeletonText size="md" className="mt-2 h-4" />
    </div>
  );
}
