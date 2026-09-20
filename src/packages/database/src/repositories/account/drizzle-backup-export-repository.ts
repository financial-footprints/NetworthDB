import { backupExports } from "@database/schema/backup-exports";
import type { DbClient } from "@database/types";
import { BackupExport, type BackupExportRepository } from "@ndb/core";
import { eq, lte } from "drizzle-orm";

function mapRow(row: typeof backupExports.$inferSelect): BackupExport {
  return new BackupExport(
    row.id,
    row.userId,
    row.jobId,
    row.filename,
    row.bytes,
    row.createdAt,
    row.expiresAt
  );
}

function toValues(row: BackupExport) {
  return {
    id: row.id,
    userId: row.userId,
    jobId: row.jobId,
    filename: row.filename,
    bytes: row.bytes,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
  };
}

export class DrizzleBackupExportRepository implements BackupExportRepository {
  constructor(private readonly db: DbClient) {}

  async findByUserId(userId: string): Promise<BackupExport | null> {
    const rows = await this.db
      .select()
      .from(backupExports)
      .where(eq(backupExports.userId, userId))
      .limit(1);
    const row = rows[0];
    return row ? mapRow(row) : null;
  }

  async upsert(row: BackupExport): Promise<BackupExport> {
    const existing = await this.findByUserId(row.userId);
    if (existing) {
      const updated = await this.db
        .update(backupExports)
        .set({
          id: row.id,
          jobId: row.jobId,
          filename: row.filename,
          bytes: row.bytes,
          createdAt: row.createdAt,
          expiresAt: row.expiresAt,
        })
        .where(eq(backupExports.userId, row.userId))
        .returning();
      const saved = updated[0];
      if (!saved) {
        throw new Error("database.backup-export.upsert.error.no-row");
      }
      return mapRow(saved);
    }

    const inserted = await this.db.insert(backupExports).values(toValues(row)).returning();
    const created = inserted[0];
    if (!created) {
      throw new Error("database.backup-export.upsert.error.no-row");
    }
    return mapRow(created);
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.db.delete(backupExports).where(eq(backupExports.userId, userId));
  }

  async findExpired(now: Date): Promise<BackupExport[]> {
    const rows = await this.db
      .select()
      .from(backupExports)
      .where(lte(backupExports.expiresAt, now));
    return rows.map(mapRow);
  }
}
