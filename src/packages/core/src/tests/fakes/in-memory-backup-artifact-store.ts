import { readFile } from "node:fs/promises";
import type {
  BackupArtifactRead,
  BackupArtifactStore,
  BackupExportFiles,
  BackupImportFiles,
} from "@core/domains/account/backup/ports/backup-archive";

class MemoryExportWorkspace implements BackupExportFiles {
  private readonly files = new Map<string, string>();

  constructor(private readonly store: InMemoryBackupArtifactStore) {}

  async writeJson(name: string, value: unknown): Promise<void> {
    this.files.set(name, `${JSON.stringify(value, null, 2)}\n`);
  }

  async writeText(name: string, content: string): Promise<void> {
    this.files.set(name, content);
  }

  async appendJsonl(name: string, value: unknown): Promise<void> {
    const line = `${JSON.stringify(value)}\n`;
    this.files.set(name, `${this.files.get(name) ?? ""}${line}`);
  }

  async finalizeTo(destPath: string, _password: string): Promise<number> {
    const payload = JSON.stringify(Object.fromEntries(this.files));
    const bytes = new TextEncoder().encode(payload);
    this.store.putBytes(destPath, bytes);
    return bytes.byteLength;
  }
}

class MemoryImportFiles implements BackupImportFiles {
  constructor(private readonly files: Map<string, string>) {}

  async readText(name: string): Promise<string | undefined> {
    return this.files.get(name);
  }

  async *readJsonl(name: string): AsyncIterable<unknown> {
    const raw = this.files.get(name);
    if (raw === undefined) {
      return;
    }
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      yield JSON.parse(trimmed) as unknown;
    }
  }
}

export class InMemoryBackupArtifactStore implements BackupArtifactStore {
  private readonly artifacts = new Map<string, Uint8Array>();

  putBytes(path: string, bytes: Uint8Array): void {
    this.artifacts.set(path, bytes);
  }

  artifactPath(userId: string, jobId: string): string {
    return `memory:${userId}:${jobId}`;
  }

  async createExportWorkspace(): Promise<BackupExportFiles> {
    return new MemoryExportWorkspace(this);
  }

  async openZipFromPath(path: string, _password: string): Promise<BackupImportFiles> {
    const stored = this.artifacts.get(path);
    const bytes = stored ?? new Uint8Array(await readFile(path));
    const text = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(text) as Record<string, string>;
    return new MemoryImportFiles(new Map(Object.entries(parsed)));
  }

  async saveStagingPath(userId: string, jobId: string): Promise<string> {
    return `${this.artifactPath(userId, jobId)}.partial`;
  }

  async promoteStaging(userId: string, jobId: string): Promise<number> {
    const staging = await this.saveStagingPath(userId, jobId);
    const bytes = this.artifacts.get(staging);
    if (!bytes) {
      throw new Error("tests.backup.artifact.staging-missing");
    }
    const dest = this.artifactPath(userId, jobId);
    this.artifacts.set(dest, bytes);
    this.artifacts.delete(staging);
    return bytes.byteLength;
  }

  async readArtifact(userId: string, jobId: string): Promise<BackupArtifactRead> {
    const bytes = this.artifacts.get(this.artifactPath(userId, jobId));
    if (!bytes) {
      throw new Error("tests.backup.artifact.missing");
    }
    return { bytes };
  }

  async deleteArtifact(userId: string, jobId: string): Promise<void> {
    this.artifacts.delete(this.artifactPath(userId, jobId));
    this.artifacts.delete(`${this.artifactPath(userId, jobId)}.partial`);
  }
}
