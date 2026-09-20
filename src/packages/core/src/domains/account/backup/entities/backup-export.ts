import { BACKUP_EXPORT_TTL_MS } from "@core/domains/account/backup/constants";

export class BackupExport {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly jobId: string,
    public readonly filename: string,
    public readonly bytes: number,
    public readonly createdAt: Date,
    public readonly expiresAt: Date
  ) {}

  static create(props: {
    userId: string;
    jobId: string;
    filename: string;
    bytes: number;
    now?: Date;
  }): BackupExport {
    const createdAt = props.now ?? new Date();
    return new BackupExport(
      crypto.randomUUID(),
      props.userId,
      props.jobId,
      props.filename,
      props.bytes,
      createdAt,
      new Date(createdAt.getTime() + BACKUP_EXPORT_TTL_MS)
    );
  }

  isExpired(now: Date = new Date()): boolean {
    return now.getTime() >= this.expiresAt.getTime();
  }
}
