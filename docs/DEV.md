# Developer Guide

## Prerequisites

- [Bun](https://bun.sh)
- [Docker](https://www.docker.com) (Postgres)

## Quick Start

```bash
make setup
make dev
```

| Service  | URL / connection                                      |
| -------- | ----------------------------------------------------- |
| API      | <http://127.0.0.1:8000/health>                          |
| Web UI   | <http://127.0.0.1:3000> (proxies `/api` to the API)     |
| Postgres | `localhost:5451` — database/user/password: `networthdb` |

Local config: copy `src/apps/api/.env.example` → `src/apps/api/.env` (also done by `make setup`).

## Parallel Statement Sync

Bulk **sync all credit cards** in the UI fires one HTTP job per card. Up to `JOBS_MAX_WORKERS` pipelines run at once (default **10** in `.env.example`; Bruno/tests use `2` in `.env.tests`).

| Layer | Role |
| ----- | ---- |
| `JobRunnerService` | Schedules up to N job callbacks concurrently |
| `createPool({ threads: N })` | Runs pipeline compute in `worker_threads` |

During `make dev`, pipeline workers write tagged JSON log lines to the terminal (`jobId`, `accountId`). Lines from multiple workers interleave — that is expected. The API `/health` endpoint stays responsive while sync jobs run.

Set `JOBS_MAX_WORKERS=10` (or higher) in `src/apps/api/.env` when testing parallel sync locally.

## Database

Migrations run during `make setup`. With `ENVIRONMENT=local`, seed creates dev users (`admin`, `manasi`, `usher`; password `admin`).

Apply migrations manually:

```bash
bun run --filter @ndb/database migrate
```

Generate migrations after schema changes:

```bash
make migrations name=<name>
```

Schema lives in `src/packages/database/src/schema/`. Do not hand-edit files under `drizzle/migrations/`.

## Make Targets

| Target       | Description                                    |
| ------------ | ---------------------------------------------- |
| `help`       | List targets                                   |
| `install`    | `bun install`                                  |
| `setup`      | Env files, install, Postgres, migrate          |
| `migrations` | Generate Drizzle migrations (`name=<name>`)    |
| `update`     | `bun update` within current ranges             |
| `upgrade`    | Latest Bun and dependencies                    |
| `dev`        | Postgres + parallel API/web watch              |
| `kill`       | Free app ports and stop Postgres               |
| `check`      | biome, type-check, bun test, bruno             |
| `ci`         | Same as `check`, no writes                     |
| `clean`      | Remove `dist/` and stop Postgres               |

## Statement Compute

`@ndb/statements` is pure TypeScript: extract, cleanup, metadata, parse, vault I/O, and a worker pool. Bootstrap wires `wrap(createPool(...), config)` at API startup. See [ADR-005](adr/005-statements-compute.md).

Regenerate the Bruno upload PDF fixture (rare):

```bash
bun run --filter @ndb/statements gen:bruno-pdf
```

## Further Reading

Architecture decisions: [docs/adr/](adr/README.md).

Agent and coding conventions: [AGENT.md](../AGENT.md).

Environment variables: `src/apps/api/.env.example`.
