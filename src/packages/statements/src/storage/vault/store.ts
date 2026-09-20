import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { decrypt, encrypt, isEncrypted } from "@ndb/encryption";

export const NWENC_SUFFIX = ".nwenc";
export const VAULT_DIR = ".vault";

export type FileStoreConfig = {
  tenantRoot: string;
  encryptAtRest: boolean;
  dataKey: Buffer | null;
};

export function toPosixRelative(relative: string): string {
  return relative.replaceAll("\\", "/");
}

export class VaultStore {
  private readonly vaultRoot: string;

  constructor(private readonly config: FileStoreConfig) {
    this.vaultRoot = join(config.tenantRoot, VAULT_DIR);
  }

  writeBytes(relative: string, data: Buffer): void {
    const key = toPosixRelative(relative);
    if (this.config.encryptAtRest) {
      if (!this.config.dataKey) {
        throw new Error("statements.store.invalid.key-required");
      }

      const encrypted = encrypt(this.config.dataKey, data);
      const target = this.encryptedPath(key);
      this.ensureParent(target);
      writeFileSync(target, encrypted);
      return;
    }

    const target = this.plaintextPath(key);
    this.ensureParent(target);
    writeFileSync(target, data);
  }

  readBytes(relative: string): Buffer | null {
    const key = toPosixRelative(relative);
    const plain = this.plaintextPath(key);
    if (existsSync(plain) && statSync(plain).isFile()) {
      return readFileSync(plain);
    }

    const enc = this.encryptedPath(key);
    if (!existsSync(enc) || !statSync(enc).isFile()) {
      return null;
    }

    const blob = readFileSync(enc);
    if (!isEncrypted(blob)) {
      return blob;
    }

    if (!this.config.dataKey) {
      throw new Error("statements.store.invalid.key-required");
    }

    return decrypt(this.config.dataKey, blob);
  }

  exists(relative: string): boolean {
    const key = toPosixRelative(relative);
    return (
      (existsSync(this.plaintextPath(key)) && statSync(this.plaintextPath(key)).isFile()) ||
      (existsSync(this.encryptedPath(key)) && statSync(this.encryptedPath(key)).isFile())
    );
  }

  unlink(relative: string): void {
    const key = toPosixRelative(relative);
    const plain = this.plaintextPath(key);
    const enc = this.encryptedPath(key);
    if (existsSync(plain) && statSync(plain).isFile()) {
      rmSync(plain);
    }
    if (existsSync(enc) && statSync(enc).isFile()) {
      rmSync(enc);
    }
  }

  list(prefix?: string): string[] {
    if (!existsSync(this.vaultRoot) || !statSync(this.vaultRoot).isDirectory()) {
      return [];
    }

    const normalizedPrefix = prefix ? toPosixRelative(prefix) : undefined;
    const keys = new Set<string>();
    this.collectKeys(this.vaultRoot, normalizedPrefix, keys);
    return [...keys].sort();
  }

  private plaintextPath(relative: string): string {
    return join(this.vaultRoot, relative);
  }

  private encryptedPath(relative: string): string {
    return join(this.vaultRoot, `${relative}${NWENC_SUFFIX}`);
  }

  private ensureParent(target: string): void {
    mkdirSync(dirname(target), { recursive: true });
  }

  private collectKeys(current: string, prefix: string | undefined, keys: Set<string>): void {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        this.collectKeys(path, prefix, keys);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }

      let relative = toPosixRelative(path.slice(this.vaultRoot.length + 1));
      if (relative.endsWith(NWENC_SUFFIX)) {
        relative = relative.slice(0, -NWENC_SUFFIX.length);
      }
      if (prefix && !relative.startsWith(prefix)) {
        continue;
      }
      keys.add(relative);
    }
  }
}
