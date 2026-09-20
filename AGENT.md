# Agent Guide

Rules for AI assistants working in this repository. For human setup, see [docs/DEV.md](docs/DEV.md). For architectural decisions, see [docs/adr/](docs/adr/README.md).

## Documentation Map

| Need | Read |
| --- | --- |
| Local setup, package map, make targets | [docs/DEV.md](docs/DEV.md) |
| Environment variable names and defaults | [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) |
| Architecture decisions | [docs/adr/README.md](docs/adr/README.md) |
| Statement pipeline and worker pool | [src/packages/statements/README.md](src/packages/statements/README.md) |
| Core domain bounded contexts | [src/packages/core/src/domains/README.md](src/packages/core/src/domains/README.md) |
| Dependency boundaries | [dependency-cruiser.config.mjs](dependency-cruiser.config.mjs) |
| Alignment program (historical) | [plan.md](plan.md) |

## Commands

The workspace hook blocks install, build, test, and lint commands for agents. Give the user copy-pasteable commands from the repo root.

| Command      | Purpose                              |
| ------------ | ------------------------------------ |
| `make help`  | List make targets                    |
| `make setup` | Env, install, Postgres, migrate      |
| `make dev`   | Local API, web, and Copilot HTTP watch |
| `make check` | Full verification before done        |
| `make ci`    | Check-only (no writes)               |
| `bun run format` | Biome write + markdownlint fix   |

`make check` runs: Biome, markdownlint, type-check, workspace tests, dependency-cruiser, Bruno.

Run `make check` before considering work done.

## Architecture (Where to Look)

| Concern | Location |
| ------- | -------- |
| Domain rules and ports | `src/packages/core/` |
| Persistence and schema | `src/packages/database/` |
| Auth crypto wiring | `src/packages/auth/` |
| Server NWENC1 (tier-2 blobs) | `src/packages/encryption/` |
| Statement compute | `src/packages/statements/` |
| Composition root | `src/packages/bootstrap/` |
| HTTP cross-cutting | `src/packages/middleware/` |
| Structured logging | `src/packages/logger/` |
| Email delivery | `src/packages/notifications/` |
| HTTP API | `src/apps/api/` |
| Web UI | `src/apps/web/` |
| MCP server package | `src/packages/mcp/` |
| MCP host (stdio default; optional HTTP) | `src/apps/copilot/` |
| Shared API types/paths | `src/packages/platform/` |

Package map and exports: [docs/DEV.md](docs/DEV.md) and each package's `package.json` / `index.ts`.

## Non-Negotiables

- Domain logic in `@ndb/core`; Drizzle adapters in `@ndb/database` — no domain logic in repositories.
- Apps call `loadApiRuntime()` from `@ndb/bootstrap`; do not wire services in route handlers.
- **Copilot** must never call `loadApiRuntime()`. It keeps a `SessionStore` (stdio login or HTTP `Authorization: Bearer`) and calls the HTTP API through that store (`getJson`, `requestJson`, and related methods on `SessionStore`), not in-process domain services.
- Copilot opens a read-only Postgres pool via `parseReadonlyDbEnv()` from `@ndb/database/env`, `dbPoolConfig()` from `@ndb/database/config`, and `createReadonlySqlExecutor()` from `@ndb/database/readonly` — not from `@ndb/database` root.
- HTTP transport lives in [`src/apps/copilot/src/mcp-http.ts`](src/apps/copilot/src/mcp-http.ts) using `@ndb/mcp` `createMcpHttpHandler`.
- Public `@ndb/mcp` exports are only: `assembleMcpCatalog`, `createMcpHttpHandler`, `createMcpServer`, `SessionStore`.
- MCP layout and resources: [docs/adr/010-mcp-copilot.md](docs/adr/010-mcp-copilot.md).
- Use `createLogger()` from `@ndb/logger`; no `console.*` in application code except [`src/apps/web/src/logging.ts`](src/apps/web/src/logging.ts).
- HTTP cross-cutting concerns in `@ndb/middleware` (`corsMiddleware`, `errorHandler`, `logMiddleware`, session auth).
- Classify new sensitive fields per [ADR-004](docs/adr/004-data-encryption-policy.md).
- Dev uses `src/apps/api/.env` (port **8000**); tests use committed `.env.tests` (port **8001**).

## AI Tooling

NetworthDB targets **Cursor only** (unlike Argus, we do not maintain a separate `.ai/rules/` tree). Agent guidance lives under [`.cursor/`](.cursor/).

| Kind | Location |
| ---- | -------- |
| Project rules | [`.cursor/rules/`](.cursor/rules/) |
| Skills | [`.cursor/skills/`](.cursor/skills/) — `architecture`, `api-response-patterns`, `add-domain`, `bruno-tests`, `dotted-error-messages` |
| Hooks | [`.cursor/hooks.json`](.cursor/hooks.json) — blocks edits to generated Drizzle migrations |
| Dependency boundaries | [dependency-cruiser.config.mjs](dependency-cruiser.config.mjs) (part of `make check`) |

Use skills when adding domains, API routes, Bruno tests, or reviewing layer boundaries. Dotted keys are for **logs and infra throws** only; `DomainError` messages stay human-readable (see `dotted-error-messages` skill).

## Cursor Rules

| Rule | Topic |
| ---- | ----- |
| `import-paths` | Alias imports; no relative `./` or `../` |
| `no-migration-edits` | Do not edit generated migration SQL |
| `postgres-column-alignment` | Drizzle column order for row alignment |
| `markdown-title-case` | Title case for Markdown headings |
| `structured-logging` | Dot keys for logger and infra errors |
| `document-titles` | `NetworthDB \| <Action>` via `PageTitle` |
| `shared-css-styles` | Shared Tailwind in `base.css`, not TS exports |
| `parallel-db-reads` | Parallel SELECTs outside transactions |

## References

- [docs/DEV.md](docs/DEV.md) — setup, package map, make targets
- [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) — environment variables
- [docs/adr/001-domain-driven-design.md](docs/adr/001-domain-driven-design.md) — DDD layout
- [docs/adr/004-data-encryption-policy.md](docs/adr/004-data-encryption-policy.md) — encryption tiers
- [docs/adr/005-database-migrations-and-local-seed.md](docs/adr/005-database-migrations-and-local-seed.md) — migrations and seed policy
- [src/packages/statements/README.md](src/packages/statements/README.md) — statement pipeline and worker pool
