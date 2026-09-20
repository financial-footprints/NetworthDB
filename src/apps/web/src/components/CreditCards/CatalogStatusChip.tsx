import type { SlotStatus } from "@ndb/platform";
import { Status } from "@web/components/Badge/Status";

const STATUS_LABELS: Record<SlotStatus, string> = {
  yes: "Yes",
  conditional: "Conditional",
  depends: "Depends",
  unknown: "Unknown",
  NA: "NA",
};

const STATUS_STYLES: Record<SlotStatus, string> = {
  yes: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  conditional: "bg-amber-50 text-amber-900 ring-amber-200",
  depends: "bg-sky-50 text-sky-900 ring-sky-200",
  unknown: "bg-slate-100 text-slate-700 ring-slate-200",
  NA: "bg-slate-50 text-slate-500 ring-slate-200",
};

type CatalogStatusChipProps = {
  status: SlotStatus;
};

export function CatalogStatusChip({ status }: CatalogStatusChipProps) {
  return <Status label={STATUS_LABELS[status]} className={STATUS_STYLES[status]} />;
}

export function catalogStatusLabel(status: SlotStatus): string {
  return STATUS_LABELS[status];
}
