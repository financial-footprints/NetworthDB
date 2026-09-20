---
name: add-domain
description: Add a new domain end-to-end in this monorepo (entity, port, service, schema, repo, contract, API route, web client). Use when adding features, CRUD, or new business domains.
---

# Add Domain

End-to-end workflow for a new business domain (e.g. `Widget`). Follow clean/DDD layering from [docs/adr/001-domain-driven-design.md](../../../docs/adr/001-domain-driven-design.md).

## Task Progress

```text
- [ ] 1. Entity in src/packages/core
- [ ] 2. Repository port in src/packages/core
- [ ] 3. Service in src/packages/core
- [ ] 4. Domain barrel + core index re-export
- [ ] 5. Drizzle schema in src/packages/database
- [ ] 6. Developer reviews schema, then runs migrations manually
- [ ] 7. Drizzle repository implementation
- [ ] 8. Zod schema in src/packages/platform
- [ ] 9. API route with OpenAPI
- [ ] 10. Web API client + page
- [ ] 11. Colocated tests; make check
```

## Steps

### 1. Entity

`src/packages/core/src/domains/<name>/entities/<name>.ts`

Rich object with construction rules and behaviour. No framework or database imports.

### 2. Repository Port

`src/packages/core/src/domains/<name>/repositories/<name>-repository.ts`

Interface only. Core depends on this abstraction, not Drizzle.

### 3. Service

`src/packages/core/src/domains/<name>/services/<name>-service.ts`

Application logic using the repository interface. Throw `DomainError` subclasses with **human-readable** messages — do not return HTTP status codes.

### 4. Domain Barrel

- `src/packages/core/src/domains/<name>/index.ts`
- Re-export from `src/packages/core/src/index.ts`

### 5. Drizzle Schema

`src/packages/database/src/schema/` (file or folder per aggregate)

Export from `src/packages/database/src/schema/index.ts`. Follow the `postgres-column-alignment` rule in `.cursor/rules/`.

### 6. Migrations (Developer Only)

Stop after schema and repository changes. Follow the `no-migration-edits` rule in `.cursor/rules/`. Developer runs `make migrations name=<domain>` and `bun run --filter @ndb/database migrate`.

### 7. Repository Implementation

`src/packages/database/src/repositories/<domain>/drizzle-<name>-repository.ts`

Implements the core port. Export from `src/packages/database/src/repositories/index.ts` (no per-folder barrel).

### 8. Platform Schema

`src/packages/platform/src/http/endpoints/<name>/` (or grouped under an existing module)

Zod schemas for create/update/response payloads. Export from `src/packages/platform/src/index.ts`. Core must **not** import platform.

Use target envelope helpers from `/api-response-patterns`.

### 9. API Route

`src/apps/api/src/routes/<name>/index.ts`

- Use `ApiRouter` + `.endpoint()` from [`src/apps/api/src/config/router.ts`](../../../src/apps/api/src/config/router.ts)
- Authenticated resources: `createSessionRouter()` from the same file (global `requireSession` in `createApp`; do not add per-router session middleware)
- Public endpoints: add exact paths to `PUBLIC_API_PATHS` in [`src/packages/platform/src/http/endpoints/index.ts`](../../../src/packages/platform/src/http/endpoints/index.ts)
- Request JSON: `jsonBody` / `optionalJsonBody` from [`src/apps/api/src/config/http.ts`](../../../src/apps/api/src/config/http.ts) (not `routes/auth/helpers`)
- `serializer.ts` beside the router; `schema.parse` on output
- Mount in [`src/apps/api/src/routes/index.ts`](../../../src/apps/api/src/routes/index.ts); `createApp` imports the barrel only

Wire services in [`src/packages/bootstrap`](../../../src/packages/bootstrap) (`createApiServices` inside `loadApiRuntime`). Use `c.get("services").<name>Service` (e.g. `accountService`). Domain logic stays in core; do not wire repos in route handlers.

### 10. Web

- `src/apps/web/src/utils/api/routes/<name>/` — HTTP GET as `fetchX` via `apiRequest` + platform Zod; `readX` only for in-memory cache
- Filterable list pages: `useListQuery` + `ListToolbar` (URL `q` for search)
- `src/apps/web/src/routes/<name>/page.tsx` — default-export route entry (often thin; delegates to `_parts`)
- `src/apps/web/src/routes/<name>/_parts/**/Content.tsx` — named-export page body; `suspense.tsx` for skeletons (not `loading.tsx`)
- Dynamic URLs: add `path.<resource>.details(id = ":id")` helpers in [`src/apps/web/src/router/path.ts`](../../../src/apps/web/src/router/path.ts); router uses `path.foo.details()`, links use `path.foo.details(id)`
- Register in [`src/apps/web/src/router/routes.tsx`](../../../src/apps/web/src/router/routes.tsx); public routes set `app: { public: true }`; unknown URLs use `path.notFound` (`"*"`)

### 11. Tests and Verification

- Core: colocated `*.test.ts` next to the unit; fakes from `@ndb/core/tests` (never `@tests/core`)
- API: colocated `*.test.ts` next to the route (discovered via `bun test src tests` in `@ndb/api`)
- HTTP route tests: `createTestApp` from [`src/apps/api/tests/helpers/create-test-app.ts`](../../../src/apps/api/tests/helpers/create-test-app.ts); use `loginViaApp` when a bearer token is required
- Bruno folder under `src/apps/api/tests/bruno/` for HTTP workflows
- User runs `make check`

## Reference: Health Flow (No Full Domain)

| Layer | File |
| ----- | ---- |
| Platform | health schemas in `src/packages/platform` |
| API | `src/apps/api/src/routes/health/` |
| Web | proxies `/health` |

Use for wiring style; add core/database when introducing business logic.

## Related

- Response envelopes: `/api-response-patterns`
- Import boundaries: [dependency-cruiser.config.mjs](../../../dependency-cruiser.config.mjs); `/architecture`
- Import aliases: `import-paths` rule in `.cursor/rules/`
- Web tab titles: `document-titles` rule in `.cursor/rules/`
