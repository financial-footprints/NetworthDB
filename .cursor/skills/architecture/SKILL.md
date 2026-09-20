---
name: architecture
description: DDD layer boundaries and dependency direction for this monorepo. Use when adding packages, wiring imports across layers, reviewing architecture, or unsure where code belongs (core vs database vs platform vs apps).
paths:
  - "src/packages/**"
  - "src/apps/**"
---

# Architecture

## When to Use

- Adding or moving code between packages
- Reviewing import direction or dependency boundaries
- Unsure whether logic belongs in core, database, platform, or apps

Dependencies point inward: adapters depend on the domain, never the reverse. See [docs/adr/001-domain-driven-design.md](../../../docs/adr/001-domain-driven-design.md).

## Layers

Import boundaries are enforced by [dependency-cruiser.config.mjs](../../../dependency-cruiser.config.mjs). Read rule `comment` fields when unsure what a package may import.

| Package | Contains |
| ------- | -------- |
| `src/packages/core` | Entities, services, repository *interfaces* (ports), domain errors |
| `src/packages/database` | Drizzle schema, migrations, repository *implementations* |
| `src/packages/platform` | Zod schemas, API paths, client-safe re-exports (see layout below) |
| `src/packages/middleware` | `corsMiddleware`, `errorHandler`, `logMiddleware`, session auth |
| `src/packages/logger` | Logger implementations |
| `src/packages/bootstrap` | Composition root (`loadApiRuntime`, `createApiServices`); not domain services |
| `src/packages/auth` | Crypto adapters, Valkey rate limits |
| `src/packages/encryption` | NWENC1 server blob encryption |
| `src/packages/statements` | Statement pipeline + worker pool |
| `src/packages/notifications` | Email senders |
| `src/packages/mcp` | MCP protocol + tool catalog (HTTP client to API; readonly SQL types) |
| `src/apps/api` | OpenAPI routes; calls services via bootstrap |
| `src/apps/web` | API clients, pages, components |
| `src/apps/copilot` | MCP host; **never** `loadApiRuntime()` — HTTP API + readonly Postgres only |

## `@ndb/platform` Layout

Human-edited card catalogs live in `src/packages/platform/data/credit-cards/`. TypeScript is grouped by role under `src/packages/platform/src/`:

| Folder | Role |
| ------ | ---- |
| `http/endpoints/` | `API` path constants and per-resource Zod schemas (`http/endpoints/auth/` is the auth HTTP contract, not `@ndb/auth`) |
| `http/endpoints/types.ts` | Inferred `*Api` types from endpoint schemas |
| `http/endpoints/auth/parse-login.ts` | `parseLoginResponse` for web and MCP |
| `http/envelopes.ts`, `http/error.ts` | Success list/details envelopes and error body |
| `schema/` | Reusable Zod primitives (trimmed strings, ISO dates, date-range query) |
| `logging/` | `redactObject` / `omitSensitiveFields` (shared by `@ndb/logger` and web) |
| `cards/` | Zod schema, flatten helpers (main barrel); filesystem loader via `@ndb/platform/cards/server` (reads `data/credit-cards/`) |

Consumers import the public barrel `@ndb/platform` for client-safe contracts — not `@platform/*` paths. Platform re-exports isomorphic domain constants via **`@core/...` leaf imports** (never `@ndb/core`, which pulls server services into the web bundle). API and bootstrap use `@ndb/core` for services. Catalog files load via `@ndb/platform/cards/server`.

## Copilot and MCP

- **Copilot** must not call `loadApiRuntime()`. It uses `SessionStore` and HTTP to the API; readonly SQL via `@ndb/database/env`, `@ndb/database/config`, `@ndb/database/readonly`.
- **Login/session JSON:** use `parseLoginResponse` from `@ndb/platform` (web and MCP `SessionStore`); do not fork parsers in apps.
- **`make dev`** starts API, web, and Copilot **HTTP** (`MCP_TRANSPORT=http` on the copilot dev script). Default `start` / Cursor `.cursor/mcp.json` remain **stdio**.
- **Public `@ndb/mcp` exports** are only: `assembleMcpCatalog`, `createMcpHttpHandler`, `createMcpServer`, `SessionStore`. See ADR-010.

## Error Handling

Services throw `DomainError` subclasses with **human-readable** client messages. HTTP status and success envelopes → `/api-response-patterns`. Operational log keys → `structured-logging` rule in [`.cursor/rules/`](../../rules/).

## Verification

```bash
cd /path/to/NetworthDB
bun x depcruise src/packages src/apps --config dependency-cruiser.config.mjs
```

Also part of `make check`.

## Related

- Alignment program: [plan.md](../../../plan.md)
- Add feature workflow: `/add-domain`
