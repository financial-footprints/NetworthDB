---
name: api-response-patterns
description: Canonical NetworthDB API success/error response envelopes (target contract). Use when designing or changing API routes, platform Zod schemas, web clients, or Bruno asserts.
paths:
  - "src/packages/platform/**"
  - "src/apps/api/**"
  - "src/apps/web/**"
  - "src/apps/api/tests/bruno/**"
---

# API Response Patterns

**Contract** (Argus-aligned). Platform Zod schemas are the contract; API routes serialize into envelopes; web clients parse envelopes with Zod; Bruno asserts envelope paths.

**Do not add** `errors: []` on success responses or snake_case JSON field names on the wire.

## Principles

- Success envelopes are predictable — domain payload is never at the JSON root (except health/config system endpoints).
- Errors never appear on 2xx responses. Throw from services; middleware maps `DomainError` → HTTP status + error body.
- When absence is valid, return `200` with `{ data: null }` — not `404`. Use `404` only when the requested ID does not exist.

## Success Envelopes

| Type | HTTP | Body | Platform helper (target) |
| ---- | ---- | ---- | ------------------------ |
| List | 200 | `{ items: T[], total: number }` | `paginatedListResponseSchema` in [`http/envelopes.ts`](../../../src/packages/platform/src/http/envelopes.ts) |
| Details | 200 | `{ data: T }` | `detailsResponseSchema` in `http/envelopes.ts` |
| Nullable details | 200 | `{ data: T \| null }` | `nullableDetailsResponseSchema` in `http/envelopes.ts` |
| Action | 200/201 | `{ data: ActionPayload }` | `detailsResponseSchema` in `http/envelopes.ts` |
| Delete | 204 | empty body | — |
| Health | 200 | flat `{ ok: boolean }` (or similar) | endpoint-specific |
| System | 200 | flat or `{ data }` per endpoint | — |

Full JSON examples: [examples.md](examples.md).

## Error Envelope

All failure responses use `apiErrorResponseSchema` from [`http/error.ts`](../../../src/packages/platform/src/http/error.ts) (re-exported on `@ndb/platform`):

```typescript
{ error: string; code?: string; field?: string; details?: Record<string, unknown>; rayId?: string }
```

Status mapping: [`src/packages/middleware/src/http/error.ts`](../../../src/packages/middleware/src/http/error.ts).

## JSON Field Names

**camelCase** on the wire (`accountType`, `createdAt`). Serializers map from domain camelCase.

## API Path Keys (`src/packages/platform/src/http/endpoints/index.ts`)

- Collection GET/POST → `list` / `create`
- Item by ID → `get` / `patch` / `delete` at the same level (not nested `details`)
- Path params → `{accountId}` style in OpenAPI templates (not `:id`)

## Layer Wiring

### API route

```typescript
return c.json({ data: serialize(entity) }, 200);
return c.json({ items: result.items.map(serialize), total: result.total }, 200);
return c.body(null, 204);
```

### Web client

Parse envelope with Zod; return `.data` for details; full `{ items, total }` for lists.

### Bruno

- List: `res.body.items`, `res.body.total`
- Details: `res.body.data.*`
- Error: `res.body.error`, `res.status`

## Related

- Examples: [examples.md](examples.md)
- Bruno style: `/bruno-tests`
- New domains: `/add-domain`
