import { ActionButton } from "@web/components/button";
import { DetailsField } from "@web/components/fields/DetailsField";
import type { JobResponse } from "@web/utils/api/endpoints/jobs/types";
import { formatDuration, formatTimestamp } from "@web/utils/time";

type JobDetailsViewProps = {
  job: JobResponse;
  viewCardHref?: string;
};

export function JobDetailsView({ job, viewCardHref }: JobDetailsViewProps) {
  const duration = formatDuration(job.created_at, job.completed_at);
  const warnings = job.output.warnings;

  return (
    <div className="space-y-6">
      <section className="rounded-sm border border-slate-200 bg-white p-6 shadow-sm">
        <dl className="grid gap-4 sm:grid-cols-2">
          <DetailsField
            label="Account ID"
            value={job.account_id ?? "—"}
            muted={job.account_id !== null}
          />
          {viewCardHref ? (
            <div className="space-y-0.5">
              <dt className="text-sm text-slate-400">Card</dt>
              <dd>
                <ActionButton to={viewCardHref}>View card</ActionButton>
              </dd>
            </div>
          ) : null}
          {job.financial_year ? (
            <DetailsField label="Financial year" value={job.financial_year} />
          ) : null}
          <DetailsField label="Created" value={formatTimestamp(job.created_at)} />
          <DetailsField
            label="Completed"
            value={job.completed_at ? formatTimestamp(job.completed_at) : "—"}
          />
          <DetailsField label="Duration" value={duration ?? "—"} />
          <DetailsField label="Job ID" value={job.id} muted />
        </dl>
      </section>

      {warnings.length > 0 ? (
        <section className="rounded-sm border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Warnings</h3>
          </div>
          <ul className="divide-y divide-slate-200">
            {warnings.map((warning) => (
              <li key={`${warning.kind}-${warning.account}-${warning.source_file}`} className="p-4">
                <p className="text-sm font-medium text-slate-900">{warning.message}</p>
                <dl className="mt-2 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
                  <div>
                    <dt className="inline font-medium">Kind: </dt>
                    <dd className="inline">{warning.kind}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium">Account: </dt>
                    <dd className="inline font-mono">{warning.account}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="inline font-medium">Source file: </dt>
                    <dd className="inline font-mono">{warning.source_file}</dd>
                  </div>
                  {warning.text_contains.length > 0 ? (
                    <div className="sm:col-span-2">
                      <dt className="font-medium">Text contains</dt>
                      <dd className="mt-1 font-mono">{warning.text_contains.join(", ")}</dd>
                    </div>
                  ) : null}
                </dl>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {job.logs ? (
        <section className="rounded-sm border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Logs</h3>
          </div>
          <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-slate-800">
            {job.logs}
          </pre>
        </section>
      ) : null}

      {job.error ? (
        <section role="alert" className="rounded-sm border border-red-200 bg-red-50 px-4 py-3">
          <h3 className="text-sm font-semibold text-red-900">Error</h3>
          <pre className="mt-2 font-mono text-xs leading-relaxed whitespace-pre-wrap text-red-800">
            {job.error}
          </pre>
        </section>
      ) : null}
    </div>
  );
}
