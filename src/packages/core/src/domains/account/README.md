# Account Domain

Financial account bounded context: one `Account` aggregate with metadata and statement secrets inline.

## Layout

| Path                                                                               | Contents                                            |
| ---------------------------------------------------------------------------------- | --------------------------------------------------- |
| [`constants.ts`](constants.ts)                                                   | `AccountType`, `ACCOUNT_TYPES`                      |
| [`entities/account.ts`](entities/account.ts)                                       | `Account` aggregate (passwords, mail, statement)    |
| [`modules/statements/embedded/pipeline-context.ts`](modules/statements/embedded/pipeline-context.ts) | `StatementsRuntime` and `PipelineContext` assembly |
| [`repositories/account-repository.ts`](repositories/account-repository.ts)         | Persistence port                                    |
| [`services/account-service.ts`](services/account-service.ts)                       | CRUD use cases                                      |
| Backup import/export                                                              | Client-side ZIP in web (`Zip.create` / `Zip.open`)  |
| [`modules/statements/`](modules/statements/README.md)                              | Upload, download, metadata, pipeline run            |

## Dependencies

- `AccountService` uses `assertAal2` from `auth` for MFA step-up.
- Statement file services enqueue work via `JobRunnerService` and read sources from `SourcesService` (pipeline sync only).
- Secrets at rest are encrypted by `@ndb/database` adapters (NWENC1).
- HTTP serializers compute `has_passwords` / `has_mail_settings` / `has_statement_rules` from `Account` methods.
