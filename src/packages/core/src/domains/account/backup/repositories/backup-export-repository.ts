import type { BackupExport } from "@core/domains/account/backup/entities/backup-export";

export interface BackupExportRepository {
  findByUserId(userId: string): Promise<BackupExport | null>;
  upsert(row: BackupExport): Promise<BackupExport>;
  deleteByUserId(userId: string): Promise<void>;
  findExpired(now: Date): Promise<BackupExport[]>;
}
