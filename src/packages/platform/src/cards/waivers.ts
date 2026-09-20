import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type RegistryWaiverEntry = {
  key: string;
  reason?: string;
  review_by?: string;
};

type WaiverFile = {
  waivers?: RegistryWaiverEntry[];
};

export type ParsedRegistryWaivers = {
  keys: string[];
  expired: RegistryWaiverEntry[];
};

function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

export async function readRegistryWaivers(catalogDataDir: string): Promise<ParsedRegistryWaivers> {
  const path = join(catalogDataDir, "_registry-waivers.json");
  if (!existsSync(path)) {
    return { keys: [], expired: [] };
  }
  const parsed = JSON.parse(await readFile(path, "utf8")) as WaiverFile;
  const keys = new Set<string>();
  const expired: RegistryWaiverEntry[] = [];
  const today = new Date();
  const todayUtc = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  );

  for (const waiver of parsed.waivers ?? []) {
    keys.add(waiver.key);
    if (!waiver.review_by) {
      continue;
    }
    const reviewBy = parseIsoDate(waiver.review_by);
    if (!reviewBy) {
      console.warn(
        `Warning: waiver for ${waiver.key} has invalid review_by "${waiver.review_by}".`
      );
      continue;
    }
    if (reviewBy < todayUtc) {
      expired.push(waiver);
    }
  }

  return { keys: [...keys].sort(), expired };
}
