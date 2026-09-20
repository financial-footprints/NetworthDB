import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";
import {
  fiscalYearKeyFromMonthKey,
  isCalendarYearPeriod,
  isFyPeriod,
  parseMonthPeriod,
  statementBasename,
} from "@statements/period/statement-period";

const TRANSACTIONS_PREFIX = "transactions-";
const STATEMENT_CSV_SUFFIX = ".csv";

export function fyFolderName(statementPeriod: string): string {
  if (statementPeriod === "unknown-month") {
    return "unknown-month";
  }
  if (isFyPeriod(statementPeriod) || isCalendarYearPeriod(statementPeriod)) {
    return statementPeriod;
  }
  return fiscalYearKeyFromMonthKey(statementPeriod);
}

export function statementRelativePath(
  accountType: string,
  accountId: string,
  statementPeriod: string,
  extension: string
): string {
  const ext = extension.startsWith(".") ? extension.slice(1) : extension;
  const base = statementBasename(statementPeriod);
  const fy = fyFolderName(statementPeriod);
  return `${fy}/${accountType}/${accountId}/${base}.${ext}`;
}

export function statementTxtRelative(
  accountType: string,
  accountId: string,
  statementPeriod: string
): string {
  return statementRelativePath(accountType, accountId, statementPeriod, "txt");
}

export function listMonthlyPdfRelatives(
  store: { list(prefix?: string): string[] },
  accountType: string,
  accountId: string,
  financialYear?: string | null
): string[] {
  const segment = `/${accountType}/${accountId}/`;
  const prefix = financialYear ? `${financialYear}/${accountType}/${accountId}/` : undefined;
  return store.list(prefix).filter((key) => {
    if (!key.includes(segment) || !key.endsWith(".pdf") || key.includes("/manual__")) {
      return false;
    }
    const stem =
      key
        .split("/")
        .pop()
        ?.replace(/\.pdf$/i, "") ?? "";
    if (!parseMonthPeriod(stem)) {
      return false;
    }
    if (financialYear && !key.startsWith(`${financialYear}/`)) {
      return false;
    }
    return true;
  });
}

function listAccountRelatives(
  store: { list(prefix?: string): string[] },
  accountType: string,
  accountId: string,
  financialYear: string | null | undefined,
  accept: (key: string) => boolean
): string[] {
  const segment = `/${accountType}/${accountId}/`;
  const prefix = financialYear ? `${financialYear}/${accountType}/${accountId}/` : undefined;
  return store.list(prefix).filter((key) => {
    if (!key.includes(segment) || key.includes("/manual__")) {
      return false;
    }
    if (financialYear && !key.startsWith(`${financialYear}/`)) {
      return false;
    }
    return accept(key);
  });
}

export function statementCsvPeriodStem(filePath: string): string | null {
  if (isTransactionsCsv(filePath)) {
    return null;
  }
  const name = basename(filePath);
  if (!name.toLowerCase().endsWith(STATEMENT_CSV_SUFFIX)) {
    return null;
  }
  const stem = name.slice(0, name.length - STATEMENT_CSV_SUFFIX.length);
  if (!parseMonthPeriod(stem)) {
    return null;
  }
  return stem;
}

export function transactionsCsvPeriodStem(filePath: string): string | null {
  const name = basename(filePath);
  if (!isTransactionsCsv(name)) {
    return null;
  }
  const stem = name.slice(TRANSACTIONS_PREFIX.length, name.length - STATEMENT_CSV_SUFFIX.length);
  if (!parseMonthPeriod(stem)) {
    return null;
  }
  return stem;
}

export function listMonthlyStatementCsvRelatives(
  store: { list(prefix?: string): string[] },
  accountType: string,
  accountId: string,
  financialYear?: string | null
): string[] {
  return listAccountRelatives(store, accountType, accountId, financialYear, (key) => {
    return statementCsvPeriodStem(key) !== null;
  });
}

export function listMonthlyTransactionsCsvRelatives(
  store: { list(prefix?: string): string[] },
  accountType: string,
  accountId: string,
  financialYear?: string | null
): string[] {
  return listAccountRelatives(store, accountType, accountId, financialYear, (key) => {
    return transactionsCsvPeriodStem(key) !== null;
  });
}

export function accountMetadataRelative(accountType: string, accountId: string): string {
  return `${accountType}/${accountId}/metadata.json`;
}

export function transactionsCsvName(periodStem: string): string {
  return `${TRANSACTIONS_PREFIX}${periodStem}${STATEMENT_CSV_SUFFIX}`;
}

export function transactionsCsvRelative(
  accountType: string,
  accountId: string,
  periodStem: string
): string {
  const fy = fyFolderName(periodStem);
  return `${fy}/${accountType}/${accountId}/${transactionsCsvName(periodStem)}`;
}

export function isPdfPath(filePath: string): boolean {
  return extname(filePath).toLowerCase() === ".pdf";
}

export function isCsvPath(filePath: string): boolean {
  return extname(filePath).toLowerCase() === ".csv";
}

export function isTransactionsCsv(filePath: string): boolean {
  const name = basename(filePath);
  return name.startsWith(TRANSACTIONS_PREFIX) && name.toLowerCase().endsWith(STATEMENT_CSV_SUFFIX);
}

export function uniquePath(directory: string, filename: string): string {
  const target = join(directory, filename);
  if (!existsSync(target)) {
    return target;
  }

  const stem = basename(filename, extname(filename));
  const suffix = extname(filename);
  let n = 1;
  while (true) {
    const candidate = join(directory, `${stem} (${n})${suffix}`);
    if (!existsSync(candidate)) {
      return candidate;
    }
    n += 1;
  }
}

export function iterPdfs(directory: string, recursive = false): string[] {
  return iterByExtension(directory, ".pdf", recursive);
}

export function iterCsvs(directory: string, recursive = false): string[] {
  return iterByExtension(directory, ".csv", recursive);
}

function iterByExtension(directory: string, extension: string, recursive: boolean): string[] {
  if (!existsSync(directory) || !statSync(directory).isDirectory()) {
    return [];
  }

  const paths: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (recursive) {
          walk(path);
        }
        continue;
      }
      if (entry.isFile() && extname(entry.name).toLowerCase() === extension) {
        paths.push(path);
      }
    }
  };

  walk(directory);
  return paths.sort();
}
