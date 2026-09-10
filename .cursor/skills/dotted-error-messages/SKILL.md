---
name: dotted-error-messages
description: >-
  Enforces dotted-notation error message keys for backend throws
  (package.area.function.status.message). Use when adding or migrating
  throw new Error / DomainError throws, or when the user mentions dotted
  notation, error keys, or error message conventions.
disable-model-invocation: true
---

# Dotted Error Messages

All backend `throw new …Error(…)` and intentional `throw new Error(…)` messages must use **dotted notation** keys — not plain English sentences.

## Convention

```text
<package/app>.<area-of-operation>.<function>.<status>.<message>
```

- Segments are **flexible** in count and naming; include enough context to identify origin and cause.
- Use **lowercase kebab-case** for static segments.
- Append **dynamic values** as a final segment (e.g. `` `bootstrap.config.env.required.not-found.${name}` ``).
- Minimum: at least **two** dot-separated segments; prefer **4–5** when possible.

## Package prefix map

| Source path | Prefix |
|-------------|--------|
| `src/packages/core/` | `core` |
| `src/packages/database/` | `database` |
| `src/packages/middleware/` | `middleware` |
| `src/packages/bootstrap/` | `bootstrap` |
| `src/packages/notifications/` | `notifications` |
| `src/packages/auth/` | `auth` |
| `src/apps/api/` | `api` |

**Segment hints:**

- **area** — domain or module: `auth`, `user`, `vault`, `config`, `email`, …
- **function** — operation: `create`, `login`, `verify`, `save`, `parse-body`, …
- **status** — outcome bucket: `error`, `invalid`, `not-found`, `conflict`, `unauthorized`, `forbidden`, …
- **message** — specific slug (kebab-case, no spaces)

## Error class selection

Match existing types in `src/packages/core/src/shared/errors/domain-error.ts`:

| Class | When to use |
|-------|-------------|
| `ValidationError` | Bad input, parse failures, missing fields |
| `UnauthorizedError` | Auth failures, missing/invalid tokens |
| `ForbiddenError` | Authenticated but not permitted |
| `ConflictError` | State conflicts (duplicate username, vault already initialized) |
| `EntityNotFoundError` | Missing entity — see special case below |
| `TooManyRequestsError` | Rate limits |
| `DomainError` | Generic domain failures (e.g. SMTP send failure) |
| Plain `Error` | Startup/config failures in bootstrap (established pattern) |

Put structured data in `context` / constructor options — **not** in the message string.

## Canonical examples (from this repo)

```typescript
// database — ConflictError
throw new ConflictError("database.auth.session.create.error.hash-collision");

// database — plain Error (internal invariant)
throw new Error("database.auth.recovery-code.create.error.no-row");

// middleware — UnauthorizedError
throw new UnauthorizedError("middleware.auth.mfa.bearer-not-challenge");

// notifications — DomainError
throw new DomainError("notifications.email.smtp.send.error", {
  code: "internal",
  cause: cause instanceof Error ? cause : undefined,
});

// bootstrap — plain Error (config)
throw new Error(`bootstrap.config.env.required.not-found.${name}`);
```

## Naming recipe

When writing or converting a throw:

1. Identify **package prefix** from file path.
2. Identify **area** (`auth`, `user`, `vault`, `config.env`, …).
3. Identify **function/operation** (`create`, `login`, `parse-body`, …).
4. Pick **status** segment (`error`, `invalid`, `unauthorized`, `conflict`, `not-found`, …).
5. Pick **message slug** (kebab-case, no spaces).
6. Keep `context` / `{ field, value }` options unchanged.

```typescript
// Before
throw new UnauthorizedError("invalid credentials");

// After (in auth-service login)
throw new UnauthorizedError("core.auth.login.unauthorized.invalid-credentials");
```

## EntityNotFoundError

The constructor currently builds `` `${entityName} with id '${id}' not found` ``. For migration, prefer extending usage so the **message** is a dotted key while context retains entity metadata. Options:

- Refactor constructor to accept a dotted message + context (if changing the class).
- Or use `DomainError` with `code: "not_found"` and a dotted message until the constructor is updated.

Target pattern:

```typescript
// Preferred once constructor supports it
throw new EntityNotFoundError("core.user.find.not-found", { entityName: "User", id: userIdRaw });
```

## API impact

`src/packages/middleware/src/http/error.ts` returns `error.message` in JSON for most domain errors. Migrating messages **changes API responses** (e.g. `"username taken"` → `"core.user.register.conflict.username-taken"`). Update tests that assert on `error.message` or response JSON in the same pass.

## Exceptions (no dotted key required)

- **Future frontend** user-facing copy (explicit exception).
- **Test-only helpers** (`"database client was not created"`, `"missing secret"`) — lower priority; migrate optionally.
- **Re-thrown errors** (`throw error`) — leave unchanged.
- **Default empty constructors** — replace defaults with explicit dotted keys when touching the file (e.g. `UnauthorizedError()` → `UnauthorizedError("middleware.auth.bearer.missing")`).

## Migration workflow

1. Inventory: `rg 'throw new \w+Error\(' src/` and `rg 'throw new Error\(' src/`
2. Skip or defer test helpers / fakes if desired.
3. Migrate **layer order**:
   - Bootstrap + database repos (partial coverage exists)
   - Core domain services + embedded helpers
   - Middleware + API routes
   - Tests (assertions last)
4. Convert file-by-file using the naming recipe; preserve `context` fields.
5. Update unit + Bruno tests that match on message strings.
6. User runs tests (workspace hook blocks agent execution).

## Validation grep

```bash
cd /path/to/NetworthDB

# DomainError throws with spaces or no dots (likely need migration)
rg 'throw new (Validation|Unauthorized|Conflict|Forbidden|TooManyRequests)Error\("[^"]*[^.a-z0-9-][^"]*"\)' src/

# Messages with no dot at all (heuristic)
rg 'throw new \w+Error\("(?!.*\.).*"\)' src/
```

## Additional resources

- Extended before/after conversions: [examples.md](examples.md)
