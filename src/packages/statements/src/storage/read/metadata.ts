import type { Account, StatementList } from "@ndb/core";
import { computeBalanceGaps, coveredMonth } from "@statements/pipeline/stages/metadata/coverage";
import type { StoredAccountMetadata } from "@statements/pipeline/stages/metadata/stored";
import { accountMetadataRelative } from "@statements/storage/vault/path";
import {
  statementFormatsFromVault,
  unionStatementFormats,
} from "@statements/storage/vault/statement-formats";
import type { VaultStore } from "@statements/storage/vault/store";

export function readStoredMetadata(
  store: VaultStore,
  account: Account
): StoredAccountMetadata | null {
  const relative = accountMetadataRelative(account.accountType, account.id);
  const bytes = store.readBytes(relative);
  if (!bytes) {
    return null;
  }
  try {
    return JSON.parse(bytes.toString("utf8")) as StoredAccountMetadata;
  } catch {
    return null;
  }
}

function isReadableStoredMetadata(stored: StoredAccountMetadata): boolean {
  return (
    Array.isArray(stored.statements) &&
    stored.period_covered != null &&
    Array.isArray(stored.period_covered.segments) &&
    Array.isArray(stored.period_covered.gaps) &&
    Array.isArray(stored.period_covered.months)
  );
}

export function statementListFromStored(
  stored: StoredAccountMetadata | null,
  account: Account,
  store: VaultStore
): StatementList {
  if (!stored || !isReadableStoredMetadata(stored)) {
    return {
      available: false,
      statementCount: 0,
      formats: [],
      coverage: {
        segments: [],
        gaps: [],
        months: [],
        periodCount: 0,
      },
      statements: [],
      balanceGaps: [],
    };
  }

  const statements = stored.statements.map((statement) => {
    const isAnnual = statement.granularity === "annual";
    const periodStem = statement.statement_date;
    const formats = statementFormatsFromVault(store, account.accountType, account.id, periodStem);
    return {
      accountId: account.id,
      kind: isAnnual ? ("annual" as const) : ("monthly" as const),
      period: isAnnual
        ? (statement.year_key ?? statement.statement_date)
        : coveredMonth(statement.statement_date),
      statementDate: statement.statement_date,
      formats,
      periodStart: statement.period_start,
      periodEnd: statement.period_end,
      transactionsSynced: statement.transactions_synced ?? false,
      transactionsImportId: statement.transactions_import_id ?? null,
    };
  });

  const balanceGaps = computeBalanceGaps(stored.statements).map(([month, status]) => ({
    month,
    status,
  }));

  return {
    available: true,
    statementCount: stored.statement_count,
    starting: stored.starting ?? undefined,
    ending: stored.ending ?? undefined,
    formats: unionStatementFormats(statements),
    coverage: {
      start: stored.period_covered.start ?? undefined,
      end: stored.period_covered.end ?? undefined,
      segments: stored.period_covered.segments.map((segment) => ({
        start: segment.start,
        end: segment.end,
        approximate: segment.approximate,
      })),
      gaps: stored.period_covered.gaps.map((gap) => ({
        start: gap.start,
        end: gap.end,
        balancesMatch: gap.balances_match ?? undefined,
      })),
      months: [...stored.period_covered.months],
      periodCount: stored.period_covered.period_count,
    },
    statements,
    balanceGaps,
  };
}
