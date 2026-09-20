export type BackupExportFiles = {
  writeJson(name: string, value: unknown): Promise<void>;
  writeText(name: string, content: string): Promise<void>;
  appendJsonl(name: string, value: unknown): Promise<void>;
  finalizeTo(destPath: string, password: string): Promise<number>;
};

export type BackupImportFiles = {
  readText(name: string): Promise<string | undefined>;
  readJsonl(name: string): AsyncIterable<unknown>;
};

export type BackupArtifactRead = {
  path?: string;
  bytes?: Uint8Array;
};

export interface BackupArtifactStore {
  createExportWorkspace(): Promise<BackupExportFiles>;
  openZipFromPath(path: string, password: string): Promise<BackupImportFiles>;
  artifactPath(userId: string, jobId: string): string;
  saveStagingPath(userId: string, jobId: string): Promise<string>;
  promoteStaging(userId: string, jobId: string): Promise<number>;
  readArtifact(userId: string, jobId: string): Promise<BackupArtifactRead>;
  deleteArtifact(userId: string, jobId: string): Promise<void>;
}
