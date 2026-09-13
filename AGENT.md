# Agent Guide

Rules for AI assistants working in this repository. For human setup, see [docs/DEV.md](docs/DEV.md). For architectural decisions, see [docs/adr/](docs/adr/README.md).

## Commands

The workspace hook blocks install, build, test, and lint commands for agents. Give the user copy-pasteable commands from the repo root.

| Command      | Purpose                              |
| ------------ | ------------------------------------ |
| `make help`  | List make targets                    |
| `make setup` | Env, install, Postgres, migrate      |
| `make dev`   | Local API + web watch                |
| `make check` | Full verification before done        |
| `make ci`    | Check-only (no writes)               |

Run `make check` before considering work done.

## Architecture (Where to Look)

| Concern | Location |
| ------- | -------- |
| Domain rules and ports | `src/packages/core/` |
| Persistence and schema | `src/packages/database/` |
| Auth crypto wiring | `src/packages/auth/` |
| Statement compute | `src/packages/statements/` |
| Composition root | `src/packages/bootstrap/` |
| HTTP API | `src/apps/api/` |
| Web UI | `src/apps/web/` |
| Shared API types/paths | `src/packages/platform/` |

Package map and exports: each package's `package.json` and `index.ts`.

## Non-Negotiables

- Domain logic in `@ndb/core`; Drizzle adapters in `@ndb/database` — no domain logic in repositories.
- Apps call `loadApiRuntime()` from `@ndb/bootstrap`; do not wire services in route handlers.
- Use `createLogger()` from `@ndb/logger`; no `console.*` in application code except [`src/apps/web/src/logging.ts`](src/apps/web/src/logging.ts).
- HTTP cross-cutting concerns in `@ndb/middleware`.
- Classify new sensitive fields per [ADR-004](docs/adr/004-data-encryption-policy.md).
- Dev uses `src/apps/api/.env` (port **8000**); tests use committed `.env.tests` (port **8001**).

## Cursor Rules

Project-specific agent rules live in [`.cursor/rules/`](.cursor/rules/):

| Rule | Topic |
| ---- | ----- |
| `import-paths.mdc` | Alias imports; no relative `./` or `../` |
| `no-migration-edits.mdc` | Do not edit generated migration SQL |
| `postgres-column-alignment.mdc` | Drizzle column order for row alignment |
| `markdown-title-case.mdc` | Title case for Markdown headings |

## References

- [docs/DEV.md](docs/DEV.md) — setup and make targets
- [docs/adr/001-domain-driven-design.md](docs/adr/001-domain-driven-design.md) — DDD layout
- [docs/adr/004-data-encryption-policy.md](docs/adr/004-data-encryption-policy.md) — encryption tiers
- [docs/adr/005-statements-compute.md](docs/adr/005-statements-compute.md) — statement pipeline and worker pool
