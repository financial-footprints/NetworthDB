import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { Account } from "@core/domains/account/entities/account";
import { getHandler } from "@statements/banks/handlers/index";
import { balancesMatch } from "@statements/banks/helpers/index";
import { resolvePeriodKeyWithSource } from "@statements/banks/shared/period";
import { formatAccountDate, parseAccountDateStr } from "@statements/period/account-dates";
import { approxStartFromEnd } from "@statements/period/billing-period";
import { format } from "date-fns";

const FIXTURES_ROOT = join(import.meta.dir, "fixtures");
const MANIFEST_PATH = join(FIXTURES_ROOT, "manifest.json");
const DUMMY_FILENAME = "dummy__2099-99-99.pdf";

function loadManifest(): Record<string, Record<string, unknown>> {
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as Record<string, Record<string, unknown>>;
}

function listFixturePaths(): string[] {
  const paths: string[] = [];

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      if (!entry.name.endsWith(".txt")) {
        continue;
      }
      const rel = relative(FIXTURES_ROOT, path).replaceAll("\\", "/");
      const parts = rel.split("/");
      if (parts.length < 3) {
        continue;
      }
      paths.push(rel);
    }
  };

  walk(FIXTURES_ROOT);
  return paths.sort();
}

function bankVariantFromPath(path: string): [string, string] {
  const parts = path.split("/");
  const bank = parts[0] ?? "";
  const variant = parts.length >= 3 && parts[1] !== "default" ? (parts[1] ?? "default") : "default";
  return [bank, variant];
}

function sampleAccount(bank: string, variant: string): Account {
  return Account.create({
    userId: "user-1",
    accountType: "credit_card",
    bank,
    variant: variant === "default" ? null : variant,
    openingDate: "2020-01-01",
    accountNumber: "fixture-account",
    passwords: ["x"],
  });
}

function resolvePeriodBounds(text: string, account: Account): [string | null, string | null] {
  const handler = getHandler(account.bank, account.variant ?? undefined);
  let [start, end] = handler.getStatementPeriod(text);
  if (start && end) {
    if (start > end) {
      [start, end] = [end, start];
    }
    return [formatAccountDate(start), formatAccountDate(end)];
  }
  if (!end) {
    return [null, null];
  }
  const approxStart = parseAccountDateStr(approxStartFromEnd(format(end, "yyyy-MM-dd")));
  return [approxStart ? formatAccountDate(approxStart) : null, formatAccountDate(end)];
}

function validateStatementMonth(
  rel: string,
  expected: Record<string, unknown>,
  text: string,
  account: Account
): string | null {
  if (typeof expected.statement_month !== "string") {
    return null;
  }
  const [actualMonth] = resolvePeriodKeyWithSource(text, DUMMY_FILENAME, account);
  if (actualMonth === expected.statement_month) {
    return null;
  }
  return `${rel}: month expected ${expected.statement_month}, got ${actualMonth}`;
}

function validateBalanceField(
  rel: string,
  field: "opening" | "closing",
  expected: unknown,
  actual: string | null
): string | null {
  if (typeof expected === "string") {
    if (actual && balancesMatch(actual, expected)) {
      return null;
    }
    return `${rel}: ${field} expected ${expected}, got ${actual ?? "null"}`;
  }
  if (expected === null && actual) {
    return `${rel}: expected no ${field}, got ${actual}`;
  }
  return null;
}

function validatePeriodBounds(
  rel: string,
  expected: Record<string, unknown>,
  text: string,
  account: Account
): string[] {
  if (typeof expected.period_start !== "string" || typeof expected.period_end !== "string") {
    return [];
  }
  const failures: string[] = [];
  const [periodStart, periodEnd] = resolvePeriodBounds(text, account);
  if (periodStart !== expected.period_start) {
    failures.push(`${rel}: period_start expected ${expected.period_start}, got ${periodStart}`);
  }
  if (periodEnd !== expected.period_end) {
    failures.push(`${rel}: period_end expected ${expected.period_end}, got ${periodEnd}`);
  }
  return failures;
}

function validateFixture(
  rel: string,
  expected: Record<string, unknown>,
  text: string,
  account: Account,
  handler: ReturnType<typeof getHandler>
): string[] {
  const failures: string[] = [];

  const monthFailure = validateStatementMonth(rel, expected, text, account);
  if (monthFailure) {
    failures.push(monthFailure);
  }

  const opening = handler.getOpeningBalance(text);
  const closing = handler.getClosingBalance(text);

  const openingFailure = validateBalanceField(rel, "opening", expected.opening, opening);
  if (openingFailure) {
    failures.push(openingFailure);
  }
  const closingFailure = validateBalanceField(rel, "closing", expected.closing, closing);
  if (closingFailure) {
    failures.push(closingFailure);
  }

  failures.push(...validatePeriodBounds(rel, expected, text, account));
  return failures;
}

describe("metadata fixtures", () => {
  test("every manifest entry has a fixture file", () => {
    const manifest = loadManifest();
    const missing: string[] = [];
    for (const rel of Object.keys(manifest).sort()) {
      const samplePath = join(FIXTURES_ROOT, rel);
      if (!statSync(samplePath).isFile()) {
        missing.push(`${rel}: fixture file missing`);
      }
    }
    expect(missing).toEqual([]);
  });

  test("every fixture txt has a manifest entry", () => {
    const manifest = loadManifest();
    const missing: string[] = [];
    for (const rel of listFixturePaths()) {
      if (!manifest[rel]) {
        missing.push(`${rel}: missing manifest entry`);
      }
    }
    expect(missing).toEqual([]);
  });

  test("all fixtures match manifest", () => {
    const manifest = loadManifest();
    const failures: string[] = [];

    for (const rel of listFixturePaths()) {
      const expected = manifest[rel];
      if (!expected) {
        failures.push(`${rel}: missing manifest entry`);
        continue;
      }

      const samplePath = join(FIXTURES_ROOT, rel);
      if (!statSync(samplePath).isFile()) {
        failures.push(`${rel}: fixture file missing`);
        continue;
      }

      const [bank, variant] = bankVariantFromPath(rel);
      const raw = readFileSync(samplePath, "utf8");
      const account = sampleAccount(bank, variant);
      const handler = getHandler(bank, variant === "default" ? undefined : variant);
      const text = handler.cleanText(raw);
      failures.push(...validateFixture(rel, expected, text, account, handler));
    }

    expect(failures).toEqual([]);
  });
});
