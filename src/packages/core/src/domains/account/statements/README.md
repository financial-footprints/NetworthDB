# Account Statements

Statement-file application services for an `Account`: vault metadata, upload, download, and pipeline sync. Files live in the statements vault; this module orchestrates HTTP use cases and enqueues jobs.

## Layout

| Path | Contents |
| ---- | -------- |
| `entities/pipeline.ts` | `PipelineRun` — in-memory pipeline invocation (one account, sources, data key) |
| `entities/statement-upload.ts` | Upload command value object (format, dates, filename rules) |
| `entities/statement-download.ts` | Download command value object (format validation) |
| `embedded/statements-services.ts` | `{ engine, trace }` injected at bootstrap |
| `services/statement-service.ts` | Banks list, statement list, upload, and download |
| `services/pipeline-service.ts` | Statement sync jobs and account vault delete on removal |
| `types.ts` | `StatementList`, `Statement`, coverage types, and pipeline result types |

After a successful upload or sync job callback, `LedgerIngestService` (attached at bootstrap) ingests unsynced vault transaction CSVs into the SQL ledger in the same job.

## Type Roles

| Type | Kind | Role |
|------|------|------|
| `PipelineRun` | Command entity | Built when a job callback starts: one account, sources, key, job id, kind. **Not persisted.** |
| `Job` | Persisted row | Queue work unit (`sync` / `upload` / `delete`) |
| `StatementList` | Read model | Vault metadata for one account (coverage, balance gaps, period rows). |
| `Statement` | Value object | One monthly/annual period row inside `StatementList.statements`. |

## Dependencies

- `StatementService` and `PipelineService` depend on `StatementsServices` (`engine` + `trace`, injected at bootstrap).
- `PipelineService.sync` requires `accountId`; builds `PipelineRun.createSync()` and calls `engine.processPipeline(pipeline, shouldCancel)`.
- Upload/delete use `PipelineRun.createUpload()` / `createDelete()`.
- Compute is implemented by `@ndb/statements` through the `StatementEngine` port.
