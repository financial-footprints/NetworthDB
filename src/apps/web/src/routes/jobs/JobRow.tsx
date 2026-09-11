import { DangerButton } from "@web/components/button";
import { BankIcon } from "@web/components/icon/Bank";
import { path } from "@web/router/routes";
import { formatJobMetaLine, resolveJobDisplay } from "@web/routes/jobs/display";
import { JobStatusBadges } from "@web/routes/jobs/JobStatusBadges";
import type { Account } from "@web/utils/api/endpoints/accounts/types";
import { isActiveJob } from "@web/utils/api/endpoints/jobs";
import { STATUS_LABELS } from "@web/utils/api/endpoints/jobs/labels";
import type { JobResponse } from "@web/utils/api/endpoints/jobs/types";
import { FaSync } from "react-icons/fa";
import { Link } from "react-router-dom";

type JobRowProps = {
  job: JobResponse;
  accountIndex: Map<string, Account>;
  onStop?: (jobId: string) => void;
  stoppingJobId?: string | null;
};

export function JobRow({ job, accountIndex, onStop, stoppingJobId }: JobRowProps) {
  const display = resolveJobDisplay(job, accountIndex);
  const metaLine = formatJobMetaLine(job, display);
  const active = isActiveJob(job);
  const stopping = stoppingJobId === job.id;

  return (
    <div className="group flex items-center gap-4 rounded-sm border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md">
      {display.account ? (
        <BankIcon bank={display.account.bank} />
      ) : (
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-slate-50 ring-1 ring-slate-200"
          aria-hidden
        >
          <FaSync className="h-4 w-4 text-slate-500" />
        </div>
      )}

      <Link
        to={path.jobs.get(job.id)}
        className="min-w-0 flex-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        aria-label={`${display.title}, ${STATUS_LABELS[job.status]}, ${display.typeLabel}`}
      >
        <p className="truncate text-base font-semibold text-slate-900 group-hover:text-slate-950">
          {display.title}
        </p>
        <p className="mt-1 truncate text-sm text-slate-500">{metaLine}</p>
      </Link>

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        <JobStatusBadges job={job} typeLabel={display.typeLabel} />
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
