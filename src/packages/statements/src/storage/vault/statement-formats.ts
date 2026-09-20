import {
  statementRelativePath,
  statementTxtRelative,
  transactionsCsvRelative,
} from "@statements/storage/vault/path";
import type { VaultStore } from "@statements/storage/vault/store";

export type StatementVaultFormat = "pdf" | "txt" | "csv" | "transactions";

const FORMAT_ORDER: StatementVaultFormat[] = ["pdf", "txt", "csv", "transactions"];

export function statementFormatsFromVault(
  store: VaultStore,
  accountType: string,
  accountId: string,
  periodStem: string
): StatementVaultFormat[] {
  const formats: StatementVaultFormat[] = [];
  if (store.exists(statementRelativePath(accountType, accountId, periodStem, "pdf"))) {
    formats.push("pdf");
  }
  if (store.exists(statementTxtRelative(accountType, accountId, periodStem))) {
    formats.push("txt");
  }
  if (store.exists(statementRelativePath(accountType, accountId, periodStem, "csv"))) {
    formats.push("csv");
  }
  if (store.exists(transactionsCsvRelative(accountType, accountId, periodStem))) {
    formats.push("transactions");
  }
  return formats.sort((left, right) => FORMAT_ORDER.indexOf(left) - FORMAT_ORDER.indexOf(right));
}

export function unionStatementFormats(
  statements: ReadonlyArray<{ formats: readonly string[] }>
): string[] {
  const merged = new Set<string>();
  for (const statement of statements) {
    for (const format of statement.formats) {
      merged.add(format);
    }
  }
  return [...merged].sort(
    (left, right) =>
      FORMAT_ORDER.indexOf(left as StatementVaultFormat) -
      FORMAT_ORDER.indexOf(right as StatementVaultFormat)
  );
}
