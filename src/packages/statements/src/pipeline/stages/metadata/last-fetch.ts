import type { Account } from "@ndb/core";
import type { StatementsEngineConfig } from "@statements/config/runtime";
import { openVaultStore } from "@statements/config/runtime";
import { formatAccountDate, parseAccountDateStr, utcToday } from "@statements/period/account-dates";
import { accountMetadataRelative } from "@statements/storage/vault/path";

export async function readLastFetchDate(
  config: StatementsEngineConfig,
  userId: string,
  dataKey: Buffer | null,
  account: Account
): Promise<Date | null> {
  const store = openVaultStore(config, userId, dataKey);
  const relative = accountMetadataRelative(account.accountType, account.id);
  const bytes = store.readBytes(relative);
  if (!bytes) {
    return null;
  }

  try {
    const payload = JSON.parse(bytes.toString("utf8")) as { last_fetch_date?: string };
    const value = payload.last_fetch_date;
    return value ? parseAccountDateStr(value) : null;
  } catch {
    return null;
  }
}

export function writeLastFetchDate(
  config: StatementsEngineConfig,
  userId: string,
  dataKey: Buffer | null,
  account: Account,
  fetchDate: Date = utcToday()
): void {
  const store = openVaultStore(config, userId, dataKey);
  const relative = accountMetadataRelative(account.accountType, account.id);
  const existing = store.readBytes(relative);
  const payload =
    existing && existing.length > 0
      ? (JSON.parse(existing.toString("utf8")) as Record<string, unknown>)
      : {};

  payload.last_fetch_date = formatAccountDate(fetchDate);
  store.writeBytes(relative, Buffer.from(JSON.stringify(payload, null, 2)));
}
