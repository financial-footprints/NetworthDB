import type { BackupExport } from "@core/domains/account/backup/entities/backup-export";
import type { BackupExportRepository } from "@core/domains/account/backup/repositories/backup-export-repository";

export class InMemoryBackupExportRepository implements BackupExportRepository {
  private readonly byUserId = new Map<string, BackupExport>();

  async findByUserId(userId: string): Promise<BackupExport | null> {
    return this.byUserId.get(userId) ?? null;
  }

  async upsert(row: BackupExport): Promise<BackupExport> {
    this.byUserId.set(row.userId, row);
    return row;
  }

  async deleteByUserId(userId: string): Promise<void> {
    this.byUserId.delete(userId);
  }

  async findExpired(now: Date): Promise<BackupExport[]> {
    return [...this.byUserId.values()].filter((row) => row.isExpired(now));
  }
}
