# Account Domain

Financial account bounded context: one `Account` aggregate with metadata and statement secrets inline.

## Layout

| Path | Contents |
| ---- | -------- |
| [`constants.ts`](constants.ts) | `AccountType`, `ACCOUNT_TYPES` |
| [`entities/account.ts`](entities/account.ts) | `Account` aggregate (passwords, mail, statement rules) |
| [`repositories/account-repository.ts`](repositories/account-repository.ts) | Persistence port |
| [`services/account-service.ts`](services/account-service.ts) | CRUD, system accounts; exposes `statements` and `pipeline` facades |
| [`statements/`](statements/README.md) | Upload, download, metadata, pipeline sync (`StatementService`, `PipelineService`) |
| [`taxonomy/`](taxonomy/README.md) | Transaction categories and tags |
| [`transactions/`](transactions/README.md) | SQL ledger |
| [`rules/`](rules/README.md) | Transaction rule groups, triggers, and actions |
| [`backup/`](backup/README.md) | ZIP export/import (`BackupService`, archive types) |
| [`dashboard/`](dashboard/README.md) | Range snapshot (`DashboardService`, snapshot types) |

Prefer short names inside the account context (for example `account.statements.upload`, `account.pipeline.sync`) over flattened method names on `AccountService`. Backup runs as `backup_export` / `backup_import` jobs; the browser uploads or downloads the ZIP.

## Dependencies

- `AccountService` uses `assertAal2` from auth for MFA step-up.
- Statement work enqueues jobs via `JobRunnerService` and reads sources from `SourcesService` for pipeline sync.
- Secrets at rest are encrypted by `@ndb/database` adapters (NWENC1).
- HTTP serializers compute `hasPasswords` / `hasMailSettings` / `hasStatementRules` from `Account` methods.
