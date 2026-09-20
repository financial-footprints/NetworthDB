import { backupExportStatusSchema } from "@ndb/platform";

type BackupExportStatusInput = {
  current: {
    filename: string;
    bytes: number;
    createdAt: Date;
    expiresAt: Date;
  } | null;
  activeJobId: string | null;
  activeImportJobId: string | null;
};

export function serializeBackupExportStatus(status: BackupExportStatusInput) {
  return backupExportStatusSchema.parse({
    data: {
      current: status.current
        ? {
            filename: status.current.filename,
            bytes: status.current.bytes,
            createdAt: status.current.createdAt.toISOString(),
            expiresAt: status.current.expiresAt.toISOString(),
          }
        : null,
      activeJobId: status.activeJobId,
      activeImportJobId: status.activeImportJobId,
    },
  });
}
