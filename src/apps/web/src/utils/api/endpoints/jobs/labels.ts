import type { JobStatus } from "@web/utils/api/endpoints/jobs/types";

export const STATUS_LABELS: Record<JobStatus, string> = {
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const STATUS_STYLES: Record<JobStatus, { badge: string }> = {
  queued: {
    badge: "bg-amber-50 text-amber-800 ring-amber-200",
  },
  running: {
    badge: "bg-blue-50 text-blue-800 ring-blue-200",
  },
  completed: {
    badge: "bg-green-50 text-green-800 ring-green-200",
  },
  failed: {
    badge: "bg-red-50 text-red-800 ring-red-200",
  },
  cancelled: {
    badge: "bg-slate-50 text-slate-700 ring-slate-200",
  },
};

const TYPE_LABELS: Record<string, string> = {
  sync: "Sync",
  upload: "Upload",
};

export const TYPE_STYLES = {
  badge: "bg-slate-50 text-slate-700 ring-slate-200",
} as const;

export function jobTypeLabel(stage: string): string {
  return TYPE_LABELS[stage] ?? stage;
}
