import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AppEnv } from "@ndb/core";
import type { LogLevel } from "@ndb/logger";
import { VaultStore } from "@statements/storage/vault/store";

export type StatementsEngineConfig = {
  filestorePath: string;
  encryptAtRest: boolean;
  logLevel: LogLevel;
  environment: AppEnv;
};

export const EPHEMERAL_DIR_NAME = "networthdb-ephemeral";

export function ephemeralPath(): string {
  return join(tmpdir(), EPHEMERAL_DIR_NAME);
}

export function tenantRoot(filestorePath: string, userId: string): string {
  return join(filestorePath, userId);
}

export function openVaultStore(
  config: StatementsEngineConfig,
  userId: string,
  dataKey: Buffer | null
): VaultStore {
  if (config.encryptAtRest && !dataKey) {
    throw new Error("statements.store.invalid.key-required");
  }

  return new VaultStore({
    tenantRoot: tenantRoot(config.filestorePath, userId),
    encryptAtRest: config.encryptAtRest,
    dataKey,
  });
}

export function ensureEngineDirectories(config: StatementsEngineConfig): void {
  mkdirSync(config.filestorePath, { recursive: true });
  mkdirSync(ephemeralPath(), { recursive: true });
}
