# Developer docs

## Prerequisites

Rust, Bun, Docker.

## Quick start

```bash
make setup
make dev
```

- API health: `http://127.0.0.1:8000/health`
- Web UI: `http://127.0.0.1:3000` (Rsbuild dev server; proxies `/api` to the API)
- Postgres: `localhost:5451` (`networthdb` / `networthdb`)

`make dev` starts the API, NAPI watchers, and the web app in parallel (`bun run --parallel --workspaces --if-present dev`).

## Database Migrations

Migrations run automatically during `make setup`. When `ENVIRONMENT=local`, seed applies dev fixtures (`admin`, `manasi`, `usher` — password `admin`).

To apply migrations manually when Postgres is already running:

```bash
bun run --filter @ndb/database migrate
```

Generate new migrations after schema changes: `make migrations name=<name>`.

## Make

| Target       | Description                                              |
| ------------ | -------------------------------------------------------- |
| `help`       | List make targets                                        |
| `install`    | `bun install`, NAPI debug builds for logger and statements |
| `setup`      | Copy `.env`, install, start Postgres, and migrate       |
| `migrations` | Generate Drizzle migrations from schema (`name=<name>`) |
| `update`     | `cargo update` and `bun update` within current ranges    |
| `upgrade`    | Latest stable Rust, Bun, and all dependencies            |
| `dev`        | Postgres + parallel API/logger/statements/web watch      |
| `kill`       | Free app ports and stop Postgres                         |
| `check`      | fmt, clippy, tests, biome, tsc, bun test, bruno          |
| `ci`         | Same as check, no writes                                 |
| `clean`      | Remove `target/` and NAPI artifacts (logger, statements) |

Config: [src/apps/api/.env.example](../src/apps/api/.env.example) → `src/apps/api/.env`.

Architecture: [adr/001-domain-driven-design.md](adr/001-domain-driven-design.md),
[adr/002-authentication.md](adr/002-authentication.md),
[adr/003-end-to-end-encryption.md](adr/003-end-to-end-encryption.md),
[adr/004-data-encryption-policy.md](adr/004-data-encryption-policy.md),
[adr/005-statements-compute.md](adr/005-statements-compute.md).

## Observability

All operational logs are JSON lines written by the Rust `logger` crate and exposed
through `@ndb/logger`. Each HTTP request gets
a `rayId` on the `X-Request-Id` response header and in every log line for that
request.

Log messages must not be empty. Prefer stable keys like `middleware.http.ok` for
operational events and plain sentences for user-facing errors. Put variable data in
log context, not in the message string.

## NAPI compute packages

Heavy computation lives in `@ndb/statements` (Rust + NAPI) — the NetworthCSV port for
statement extract, cleanup, metadata, parse, and on-disk vault I/O (`FILESTORE_PATH`).
`@ndb/logger` is the other NAPI package. Statements reads process env for storage roots;
callers pass `userId`, data keys, and domain payloads. No database or HTTP inside NAPI
packages. The sibling `../NetworthCSV` checkout is a read-only behavior reference;
runtime behavior is defined by `@ndb/statements`. Port progress:
[PLAN.md](../PLAN.md) at the repo root.
