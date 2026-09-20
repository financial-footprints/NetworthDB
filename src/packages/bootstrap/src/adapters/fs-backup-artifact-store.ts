import {
  appendFile,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type {
  BackupArtifactRead,
  BackupArtifactStore,
  BackupExportFiles,
  BackupImportFiles,
} from "@ndb/core";
import {
  BlobReader,
  BlobWriter,
  configure,
  type FileEntry,
  TextWriter,
  ZipReader,
  ZipWriter,
} from "@zip.js/zip.js";

configure({ useWebWorkers: false });

class FsExportWorkspace implements BackupExportFiles {
  constructor(private readonly dir: string) {}

  async writeJson(name: string, value: unknown): Promise<void> {
    await writeFile(join(this.dir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  }

  async writeText(name: string, content: string): Promise<void> {
    await writeFile(join(this.dir, name), content, "utf8");
  }

  async appendJsonl(name: string, value: unknown): Promise<void> {
    await appendFile(join(this.dir, name), `${JSON.stringify(value)}\n`, "utf8");
  }

  async finalizeTo(destPath: string, password: string): Promise<number> {
    try {
      const blobWriter = new BlobWriter("application/zip");
      const zipWriter = new ZipWriter(blobWriter);
      const names = await readdir(this.dir);

      for (const filename of names) {
        const contents = await readFile(join(this.dir, filename));
        const copy = new Uint8Array(contents.byteLength);
        copy.set(contents);
        await zipWriter.add(filename, new BlobReader(new Blob([copy])), {
          password,
          encryptionStrength: 3,
        });
      }

      await zipWriter.close();
      const blob = await blobWriter.getData();
      const bytes = new Uint8Array(await blob.arrayBuffer());
      await mkdir(dirname(destPath), { recursive: true });
      await writeFile(destPath, bytes);
      return bytes.byteLength;
    } finally {
      await rm(this.dir, { recursive: true, force: true });
    }
  }
}

class FsImportFiles implements BackupImportFiles {
  constructor(private readonly entries: Map<string, string>) {}

  async readText(name: string): Promise<string | undefined> {
    return this.entries.get(name);
  }

  async *readJsonl(name: string): AsyncIterable<unknown> {
    const raw = this.entries.get(name);
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

export class FsBackupArtifactStore implements BackupArtifactStore {
  constructor(private readonly filestorePath: string) {}

  artifactPath(userId: string, jobId: string): string {
    return join(this.filestorePath, userId, "backups", `${jobId}.zip`);
  }

  private stagingPath(userId: string, jobId: string): string {
    return `${this.artifactPath(userId, jobId)}.partial`;
  }

  async createExportWorkspace(): Promise<BackupExportFiles> {
    const dir = join(tmpdir(), `ndb-backup-export-${crypto.randomUUID()}`);
    await mkdir(dir, { recursive: true });
    return new FsExportWorkspace(dir);
  }

  async openZipFromPath(path: string, password: string): Promise<BackupImportFiles> {
    const fileBytes = await readFile(path);
    const copy = new Uint8Array(fileBytes.byteLength);
    copy.set(fileBytes);
    const zipReader = new ZipReader(new BlobReader(new Blob([copy])), {
      password,
    });

    try {
      const entries = await zipReader.getEntries();
      const files = new Map<string, string>();

      for (const entry of entries) {
        if (entry.directory) {
          continue;
        }
        const fileEntry = entry as FileEntry;
        const writer = new TextWriter();
        await fileEntry.getData(writer);
        const text = await writer.getData();
        files.set(fileEntry.filename, text);
      }

      return new FsImportFiles(files);
    } finally {
      await zipReader.close();
    }
  }

  async saveStagingPath(userId: string, jobId: string): Promise<string> {
    await mkdir(join(this.filestorePath, userId, "backups"), { recursive: true });
    return this.stagingPath(userId, jobId);
  }

  async promoteStaging(userId: string, jobId: string): Promise<number> {
    const staging = this.stagingPath(userId, jobId);
    const dest = this.artifactPath(userId, jobId);
    await rename(staging, dest);
    const info = await stat(dest);
    return info.size;
  }

  async readArtifact(userId: string, jobId: string): Promise<BackupArtifactRead> {
    return { path: this.artifactPath(userId, jobId) };
  }

  async deleteArtifact(userId: string, jobId: string): Promise<void> {
    await rm(this.artifactPath(userId, jobId), { force: true });
    await rm(this.stagingPath(userId, jobId), { force: true });
  }
}
