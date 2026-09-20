import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ephemeralPath } from "@statements/config/runtime";

export function accountWorkspace(userId: string, accountType: string, accountId: string): string {
  return join(ephemeralPath(), userId, accountType, accountId);
}

export function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

export function writeFile(path: string, data: Buffer): void {
  ensureDir(dirname(path));
  writeFileSync(path, data);
}

export function listFiles(dir: string): string[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    return [];
  }

  const paths: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isFile()) {
      paths.push(path);
    }
  }
  return paths.sort();
}

export function clearDir(dir: string): void {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    return;
  }

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isFile()) {
      rmSync(path);
    }
  }
}
