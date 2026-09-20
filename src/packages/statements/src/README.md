# `@ndb/statements` Source Layout

TypeScript statement compute: extract email attachments, write encrypted vault artifacts, build metadata, and parse bank PDFs/CSVs into transaction CSVs.

## Architecture

```mermaid
flowchart LR
  bootstrap["@ndb/bootstrap"]
  wrap["wrap(pool)"]
  pool["createPool"]
  worker["worker.ts → process jobs"]
  pipeline["pipeline/stages/"]
  storage["storage/"]
  bootstrap --> wrap
  wrap --> pool
  pool --> worker
  worker --> pipeline
  pipeline --> storage
```

Bootstrap wires `wrap(createPool(...), config)` for compute jobs. Reads use `createStatementEngine` internally (not exported from the package root). Core builds a `PipelineRun` per job callback (one account, sources, data key).

## Layer Ownership

| Path | Role |
| ---- | ---- |
| `config/` | Engine config, vault store factory, ephemeral paths |
| `engine/` | `StatementEngine` port adapter; job dispatch, errors, types |
| `worker/` | `worker_threads` pool; `wrap()` facade |
| `pipeline/jobs/` | Job entry points, serde, cancellation |
| `pipeline/stages/` | Extract → cleanup → metadata → parse stages |
| `banks/` | Per-institution handlers and parsers |
| `storage/` | Vault read/write and path keys |
| `ingest/` | PDF, ZIP, and email extraction |
| `period/` | Billing/statement period keys (pure logic) |

## Public API

Package [`index.ts`](index.ts) exports:

- `StatementsEngineConfig` from [`config/runtime.ts`](config/runtime.ts)
- `createPool` / `Pool` / `StatementsPoolConfig` from [`worker/pool.ts`](worker/pool.ts)
- `wrap` from [`worker/port.ts`](worker/port.ts)

## Import Convention

Use `@statements/<path>` for in-package imports (see root `tsconfig.json` paths).

## Concurrency

| Layer                                                   | Role                                                       |
| ------------------------------------------------------- | ---------------------------------------------------------- |
| `JobRunnerService`                                      | Up to `JOBS_MAX_WORKERS` concurrent jobs                   |
| `createPool({ threads })`                               | Same N for `worker_threads` compute                        |
| `createLogger({ defaultContext: { jobId, accountId } })` | Per-job log lines                                          |
| `createLogger({ onLine })` when `pipeline.trace`        | Persist log lines on the job record via `onLogLine`        |

Bulk “sync all cards” = one HTTP job per account. Each job runs a single-account `PipelineRun`.
