# Developer docs

## Prerequisites

Rust, Bun, Docker.

## Quick start

```bash
make setup
make dev
```

- Health: `http://127.0.0.1:8000/health`
- Postgres: `localhost:5451` (`networthdb` / `networthdb`)

## Database migrate

`make migrate` runs Drizzle migrations, then seeds automatically:

| File | When it runs |
| ---- | ------------ |
| `drizzle/seed/seed.sql` | Every environment |
| `drizzle/seed/local.template.sql` | `ENVIRONMENT=local` only (rendered at seed time) |

In local, both run. `seed.sql` holds invariant data; `local.template.sql` holds dev fixtures (e.g. `admin` / `admin` once foundation implements hash rendering).

Re-run `make migrate` when Postgres is already up. Or use `make setup` for the full flow.

Generate new migrations after schema changes: `make migrations name=<name>`.

## Make

| Target       | Description                                              |
| ------------ | -------------------------------------------------------- |
| `help`       | List make targets                                        |
| `install`    | `bun install`, NAPI debug build for logger               |
| `setup`      | Copy `.env`, install, start Postgres, and migrate       |
| `migrate`    | Apply Drizzle migrations and seed (`@ndb/database`) |
| `migrations` | Generate Drizzle migrations from schema (`name=<name>`) |
| `update`     | `cargo update` and `bun update` within current ranges    |
| `upgrade`    | Latest stable Rust, Bun, and all dependencies            |
| `dev`        | Postgres + parallel API/logger watch                     |
| `kill`       | Free app ports and stop Postgres                         |
| `check`      | fmt, clippy, tests, biome, tsc, bun test, bruno          |
| `ci`         | Same as check, no writes                                 |
| `clean`      | Remove `target/` and logger NAPI artifacts               |

Config: [src/apps/api/.env.example](../src/apps/api/.env.example) → `src/apps/api/.env`.

Architecture: [adr/001-domain-driven-design.md](adr/001-domain-driven-design.md).

## Observability

All operational logs are JSON lines written by the Rust `logger` crate and exposed
through `@ndb/logger`. Each HTTP request gets
a `rayId` on the `X-Request-Id` response header and in every log line for that
request.

Log messages must not be empty. Prefer stable keys like `middleware.http.ok` for
operational events and plain sentences for user-facing errors. Put variable data in
log context, not in the message string.

## NAPI compute packages

Heavy computation packages (e.g. future NetworthCSV) are self-contained Rust + NAPI
workspace members. They accept collected input, run native computation, and return typed
results. Other packages import them normally — no database or HTTP inside NAPI packages.
