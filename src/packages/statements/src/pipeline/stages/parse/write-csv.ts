import type { Transaction } from "@statements/banks/parsers/common";
import type { VaultStore } from "@statements/storage/vault/store";
import { format } from "date-fns";

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function formatAmount(value: string): string {
  const num = Number.parseFloat(value);
  if (Number.isNaN(num)) {
    return "0.00";
  }
  return num.toFixed(2);
}

export function writeTransactionsCsv(
  store: VaultStore,
  pathRelative: string,
  rows: Transaction[]
): void {
  const sorted = [...rows].sort((a, b) => {
    const dateCmp = a.date.getTime() - b.date.getTime();
    if (dateCmp !== 0) {
      return dateCmp;
    }
    const fileCmp = a.sourceFile.localeCompare(b.sourceFile);
    if (fileCmp !== 0) {
      return fileCmp;
    }
    return a.description.localeCompare(b.description);
  });

  const lines = ["Date,Description,Ref,Credited,Debited,File"];
  for (const txn of sorted) {
    lines.push(
      [
        format(txn.date, "yyyy-MM-dd"),
        escapeCsv(txn.description),
        txn.refNo ?? "",
        formatAmount(txn.credited),
        formatAmount(txn.debited),
        escapeCsv(txn.sourceFile),
      ].join(",")
    );
  }

  store.writeBytes(pathRelative, Buffer.from(`${lines.join("\n")}\n`, "utf8"));
}
