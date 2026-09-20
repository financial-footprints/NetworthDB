# Account Backup

ZIP export and import for a user's financial data: accounts, transactions, taxonomy, rules, sources, profile, and vault slots.

## Layout

| Path | Contents |
| ---- | -------- |
| `constants.ts` | Archive file names, format version |
| `entities/backup-export.ts` | Export job aggregate |
| `services/backup-service.ts` | Export/import orchestration, JSONL streaming |
| `repositories/backup-export-repository.ts` | Export job persistence port |
| `ports/backup-archive.ts` | Artifact store (read/write ZIP on disk) |
| `archive/` | Manifest, profile, vault parse/serialize helpers |

## Dependencies

- Production `BackupArtifactStore`: `FsBackupArtifactStore` in `@ndb/bootstrap` (`src/adapters/fs-backup-artifact-store.ts`). Tests use `InMemoryBackupArtifactStore` in `@core/tests/fakes`.
- `BackupService` runs as `backup_export` / `backup_import` jobs via `JobRunnerService`.
- Rule JSON hydration uses `parseActionsJson` / `parseWhenJson` from `rules/embedded/`.
- HTTP routes live under `apps/api` backup endpoints; the browser uploads or downloads the ZIP.
