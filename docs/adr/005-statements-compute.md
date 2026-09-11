# ADR-005: Statement compute

## Status

Accepted (updated — compute via `@ndb/statements` NAPI + TS adapter)

## Context

Statement extract, cleanup, metadata, and parse run inside the consolidated backend,
triggered by HTTP jobs. NetworthCSV semantics remain the source of truth. Multi-tenant
isolation, tier-1 E2E account numbers, and tier-2 server-encrypted secrets apply (ADR-003,
ADR-004).

## Decision

### Rust `statements` crate owns compute

All pipeline stages, bank handlers, parsers, and vault file I/O live in
`src/packages/statements/` as an **rlib** + **cdylib** (`statements.node`). Internal
domain shapes live in `statements::domain`. NAPI wire types live in `statements::napi`.

### `@ndb/statements` exposes NAPI and the TypeScript adapter

Bootstrap calls `initStatementsRuntime()` from `@ndb/statements` at API startup, then wires
`createStatementEngine()` into `StatementsRuntime` for `AccountService`.

Core services call the engine (`processPipeline`, `processUpload`, `readAccountStatements`,
file helpers) — never NAPI directly. Job workers use `executeStatementJob()` with
`StatementsRuntime.pipelineTrace` for optional pipeline trace → job logs.

Invocation input is `PipelineContext` (`userId`, `scope`, `accounts`, `sources`) with
`dataKey` passed separately. No `AccountPlain` or `toPlain()`.

### HTTP jobs

- `POST /api/v1/accounts/statements/sync` — TypeScript `JobRunnerService` submits work; callback
  calls `compute.processPipeline(context, dataKey, shouldCancel)`.
- Upload jobs — `compute.processUpload` with the same account/source shapes already loaded.

### On-disk layout

Under `{FILESTORE_PATH}/{userId}/`, paths use account UUID (not decrypted account number).
`StoredAccountMetadata` in the vault converts to `StatementList` via
`statements::domain::convert::statement_list_from_stored` — persistence DTO, not a public
domain type.

### TypeScript boundary

- Load accounts from Drizzle → `Account` (TS class).
- Load sources from `SourcesService`.
- Build `createPipelineContext({ userId, jobScope, accounts, sources })`.
- Pass `dataKey` from `UserDataKeyLoader` into port calls.
- `@ndb/statements/src/convert/` maps core entities ↔ NAPI wire inside the adapter.

HTTP JSON uses `statements` on account details (not `metadata`). Account secrets JSON
stores `{ passwords, mailRules, statementRules }`.

## Consequences

- Developers run `make install` to build `statements.node`.
- Bruno and unit tests import `initStatementsRuntime` / `createStatementEngine` from
  `@ndb/statements`.
- Only `sync` and `upload` job stages remain for statement compute.
