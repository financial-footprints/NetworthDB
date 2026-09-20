import type { Account } from "@web/utils/api/routes/accounts/types";
import { jobTypeLabel } from "@web/utils/api/routes/jobs/labels";
import type { JobApi } from "@web/utils/api/routes/jobs/types";
import { formatAccountTitle } from "@web/utils/banks";
import { formatDuration, formatRelativeTime } from "@web/utils/time";

type JobDisplay = {
  title: string;
  subtitle: string;
  typeLabel: string;
  account: Account | null;
};

export function buildAccountIndex(accounts: Account[]): Map<string, Account> {
  const index = new Map<string, Account>();
  for (const account of accounts) {
    index.set(account.id, account);
  }
  return index;
}

export function resolveJobDisplay(job: JobApi, accountIndex: Map<string, Account>): JobDisplay {
  const account = job.accountId !== null ? (accountIndex.get(job.accountId) ?? null) : null;

  const title = account
    ? formatAccountTitle(account.bank, account.variant)
    : job.accountId
      ? job.accountId
      : "All accounts";

  const typeLabel = jobTypeLabel(job.stage);
  const subtitle = job.financialYear ?? "";

  return {
    title,
    subtitle,
    typeLabel,
    account,
  };
}

export function formatJobMetaLine(job: JobApi, display: JobDisplay): string {
  return [
    display.subtitle,
    formatRelativeTime(job.createdAt),
    formatDuration(job.createdAt, job.completedAt),
  ]
    .filter(Boolean)
    .join(" · ");
}
