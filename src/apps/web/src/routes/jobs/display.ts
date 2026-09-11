import type { Account, AccountListResponse } from "@web/utils/api/endpoints/accounts/types";
import { jobTypeLabel } from "@web/utils/api/endpoints/jobs/labels";
import type { JobResponse } from "@web/utils/api/endpoints/jobs/types";
import { formatAccountTitle } from "@web/utils/banks";
import { formatDuration, formatRelativeTime } from "@web/utils/time";

type JobDisplay = {
  title: string;
  subtitle: string;
  typeLabel: string;
  account: Account | null;
};

export function mergeAccountLists(
  creditCards: AccountListResponse,
  bankAccounts: AccountListResponse
): Account[] {
  return [...creditCards.accounts, ...bankAccounts.accounts];
}

export function buildAccountIndex(accounts: Account[]): Map<string, Account> {
  const index = new Map<string, Account>();
  for (const account of accounts) {
    index.set(account.id, account);
  }
  return index;
}

export function resolveJobDisplay(
  job: JobResponse,
  accountIndex: Map<string, Account>
): JobDisplay {
  const account = job.account_id !== null ? (accountIndex.get(job.account_id) ?? null) : null;

  const title = account
    ? formatAccountTitle(account.bank, account.variant)
    : job.account_id
      ? job.account_id
      : "All accounts";

  const typeLabel = jobTypeLabel(job.stage);
  const subtitle = job.financial_year ?? "";

  return {
    title,
    subtitle,
    typeLabel,
    account,
  };
}

export function formatJobMetaLine(job: JobResponse, display: JobDisplay): string {
  return [
    display.subtitle,
    formatRelativeTime(job.created_at),
    formatDuration(job.created_at, job.completed_at),
  ]
    .filter(Boolean)
    .join(" · ");
}
