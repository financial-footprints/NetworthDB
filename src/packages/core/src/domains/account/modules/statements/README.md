# Account statements

Statement-file application services for an `Account`: vault metadata, upload, download, and pipeline sync. Files live in the statements vault (Rust); this module orchestrates HTTP use cases and enqueues jobs.

## Layout

| Path | Contents |
| ---- | -------- |
| `entities/statement-upload.ts` | Upload command value object (format, dates, filename rules) |
| `entities/statement-download.ts` | Download command value object (format validation) |
| `services/statement-service.ts` | Banks list, statement list, upload, and download |
| `services/pipeline-service.ts` | Statement sync jobs and account vault delete on removal |
| `embedded/pipeline-context.ts` | `StatementsRuntime` and `PipelineContext` command input |
| `types.ts` | `StatementList`, `Statement`, coverage types, and pipeline result types (`StatementPipelineResult`, `Bank`, …) |

## Type roles

| Type | Kind | Role |
|------|------|------|
| `PipelineContext` | Command input | Ephemeral bundle for one pipeline invocation. Not persisted. |
| `StatementList` | Read model | Vault metadata for one account (coverage, balance gaps, period rows). |
| `Statement` | Value object | One monthly/annual period row inside `StatementList.statements`. |
| `MetadataResult` | Use-case DTO | Account details: calendar UI + `StatementList`. |

## Dependencies

- `StatementService` and `PipelineService` depend on `StatementsRuntime` (`engine` + `pipelineTrace`, injected at bootstrap).
- `StatementService.upload` and `PipelineService.sync` call `JobRunnerService.submit` via `executeStatementJob()` in the jobs domain.
- `PipelineService.sync` reads IMAP/Thunderbird sources from `SourcesService`.
- `AccountService.delete` calls `StatementService.deleteArtifacts` before removing the account row.

Compute is implemented by `@ndb/statements`; core has no Rust or NAPI imports.
