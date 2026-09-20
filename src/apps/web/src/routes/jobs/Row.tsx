import { DangerButton } from "@web/components/Button";
import { Bank } from "@web/components/Icon/Bank";
import { path } from "@web/router/routes";
import { Badges } from "@web/routes/jobs/Badges";
import { formatJobMetaLine, resolveJobDisplay } from "@web/routes/jobs/display";
import type { Account } from "@web/utils/api/routes/accounts/types";
import { isActiveJob } from "@web/utils/api/routes/jobs";
import { STATUS_LABELS } from "@web/utils/api/routes/jobs/labels";
import type { JobApi } from "@web/utils/api/routes/jobs/types";
import { FaSync } from "react-icons/fa";
import { Link } from "react-router-dom";

type JobRowProps = {
  job: JobApi;
  accountIndex: Map<string, Account>;
  onStop?: (jobId: string) => void;
  stoppingJobId?: string | null;
};

export function Row({ job, accountIndex, onStop, stoppingJobId }: JobRowProps) {
  const display = resolveJobDisplay(job, accountIndex);
  const metaLine = formatJobMetaLine(job, display);
  const active = isActiveJob(job);
  const stopping = stoppingJobId === job.id;

  return (
    <div className="group flex items-center gap-4 rounded-sm border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md">
      {display.account ? (
        <Bank bank={display.account.bank} />
      ) : (
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-slate-50 ring-1 ring-slate-200"
          aria-hidden
        >
          <FaSync className="h-4 w-4 text-slate-500" />
        </div>
      )}

      <Link
        to={path.jobs.details(job.id)}
        className="min-w-0 flex-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        aria-label={`${display.title}, ${STATUS_LABELS[job.status]}, ${display.typeLabel}`}
      >
        <p className="truncate text-base font-semibold text-slate-900 group-hover:text-slate-950">
          {display.title}
        </p>
        <p className="mt-1 truncate text-sm text-slate-500">{metaLine}</p>
      </Link>

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        <Badges job={job} typeLabel={display.typeLabel} />
        {active && onStop ? (
          <DangerButton
            disabled={stopping}
            onClick={() => {
              void onStop(job.id);
            }}
          >
            {stopping ? "Stopping…" : "Stop"}
          </DangerButton>
        ) : null}
      </div>
    </div>
  );
}
