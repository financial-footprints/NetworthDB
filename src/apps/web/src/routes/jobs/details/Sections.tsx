import { ActionButton } from "@web/components/Button";
import { DetailsField } from "@web/components/Fields/DetailsField";
import type { JobApi } from "@web/utils/api/routes/jobs/types";
import { formatDuration, formatTimestamp } from "@web/utils/time";
import { useEffect, useRef } from "react";

type JobDetailsSummaryProps = {
  job: JobApi;
  viewAccountHref?: string;
};

export function Summary({ job, viewAccountHref }: JobDetailsSummaryProps) {
  const duration = formatDuration(job.createdAt, job.completedAt);

  return (
    <section className="rounded-sm border border-slate-200 bg-white p-6 shadow-sm">
      <dl className="grid gap-4 sm:grid-cols-2">
        <DetailsField
          label="Account ID"
          value={job.accountId ?? "—"}
          muted={job.accountId !== null}
        />
        {viewAccountHref ? (
          <div className="space-y-0.5">
            <dt className="text-sm text-slate-400">Account</dt>
            <dd>
              <ActionButton to={viewAccountHref}>View Account</ActionButton>
            </dd>
          </div>
        ) : null}
        {job.financialYear ? (
          <DetailsField label="Financial Year" value={job.financialYear} />
        ) : null}
        {job.ruleId ? <DetailsField label="Rule ID" value={job.ruleId} muted /> : null}
        {job.groupId ? <DetailsField label="Group ID" value={job.groupId} muted /> : null}
        <DetailsField label="Created" value={formatTimestamp(job.createdAt)} />
        <DetailsField
          label="Completed"
          value={job.completedAt ? formatTimestamp(job.completedAt) : "—"}
        />
        <DetailsField label="Duration" value={duration ?? "—"} />
        <DetailsField label="Job ID" value={job.id} muted />
      </dl>
    </section>
  );
}

type JobRulesOutputSectionProps = {
  rules: NonNullable<JobApi["output"]["rules"]>;
};

export function RulesOutput({ rules }: JobRulesOutputSectionProps) {
  return (
    <section className="rounded-sm border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">Rules</h3>
      </div>
      <dl className="grid gap-4 p-4 sm:grid-cols-2">
        <DetailsField label="Matched" value={String(rules.matched)} />
        <DetailsField label="Mutated" value={String(rules.mutated)} />
        <DetailsField label="Deleted" value={String(rules.deleted)} />
        <DetailsField label="Skipped" value={String(rules.skipped)} />
        <DetailsField label="Dry Run" value={rules.dryRun ? "Yes" : "No"} />
      </dl>
    </section>
  );
}

type JobBackupOutputSectionProps = {
  backup: NonNullable<JobApi["output"]["backup"]>;
};

export function BackupOutput({ backup }: JobBackupOutputSectionProps) {
  return (
    <section className="rounded-sm border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">Backup</h3>
      </div>
      <dl className="grid gap-4 p-4 sm:grid-cols-2">
        {backup.filename !== undefined ? (
          <DetailsField label="Filename" value={backup.filename} />
        ) : null}
        {backup.bytes !== undefined ? (
          <DetailsField label="Size (bytes)" value={String(backup.bytes)} />
        ) : null}
        {backup.accountsCreated !== undefined ? (
          <DetailsField label="Accounts Created" value={String(backup.accountsCreated)} />
        ) : null}
        {backup.accountsUpdated !== undefined ? (
          <DetailsField label="Accounts Updated" value={String(backup.accountsUpdated)} />
        ) : null}
        {backup.transactionsInserted !== undefined ? (
          <DetailsField label="Transactions Inserted" value={String(backup.transactionsInserted)} />
        ) : null}
        {backup.transactionsSkipped !== undefined ? (
          <DetailsField label="Transactions Skipped" value={String(backup.transactionsSkipped)} />
        ) : null}
        {backup.vaultSlotsImported !== undefined ? (
          <DetailsField label="Vault Slots Imported" value={String(backup.vaultSlotsImported)} />
        ) : null}
        {backup.vaultSlotsSkipped !== undefined ? (
          <DetailsField label="Vault Slots Skipped" value={String(backup.vaultSlotsSkipped)} />
        ) : null}
      </dl>
    </section>
  );
}

type JobWarningsSectionProps = {
  warnings: JobApi["output"]["warnings"];
};

export function Warnings({ warnings }: JobWarningsSectionProps) {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <section className="rounded-sm border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">Warnings</h3>
      </div>
      <ul className="divide-y divide-slate-200">
        {warnings.map((warning) => (
          <li key={`${warning.kind}-${warning.account}-${warning.sourceFile}`} className="p-4">
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
                <dt className="inline font-medium">Source File: </dt>
                <dd className="inline font-mono">{warning.sourceFile}</dd>
              </div>
              {warning.textContains.length > 0 ? (
                <div className="sm:col-span-2">
                  <dt className="font-medium">Text Contains</dt>
                  <dd className="mt-1 font-mono">{warning.textContains.join(", ")}</dd>
                </div>
              ) : null}
            </dl>
          </li>
        ))}
      </ul>
    </section>
  );
}

type JobLogsSectionProps = {
  logs: string | null | undefined;
  active: boolean;
};

export function Logs({ logs, active }: JobLogsSectionProps) {
  const showLogs = Boolean(logs) || active;
  const logsRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (!logs || !logsRef.current) {
      return;
    }

    logsRef.current.scrollTop = logsRef.current.scrollHeight;
  }, [logs]);

  if (!showLogs) {
    return null;
  }

  return (
    <section className="rounded-sm border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">Logs</h3>
      </div>
      {logs ? (
        <pre
          ref={logsRef}
          className="max-h-96 overflow-x-auto overflow-y-auto p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-slate-800"
        >
          {logs}
        </pre>
      ) : (
        <p className="p-4 text-sm text-slate-500">Waiting for pipeline output…</p>
      )}
    </section>
  );
}

type JobErrorSectionProps = {
  error: string | null | undefined;
};

export function JobError({ error }: JobErrorSectionProps) {
  if (!error) {
    return null;
  }

  return (
    <section role="alert" className="rounded-sm border border-red-200 bg-red-50 px-4 py-3">
      <h3 className="text-sm font-semibold text-red-900">Error</h3>
      <pre className="mt-2 font-mono text-xs leading-relaxed whitespace-pre-wrap text-red-800">
        {error}
      </pre>
    </section>
  );
}
