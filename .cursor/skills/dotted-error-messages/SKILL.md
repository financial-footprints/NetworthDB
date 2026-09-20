---
name: dotted-error-messages
description: >-
  Enforces dotted-notation keys for logger calls and infrastructure throws;
  forbids dotted keys as DomainError client messages. Use when adding logs,
  bootstrap/database config throws, or when reviewing error message style.
disable-model-invocation: true
---

# Dotted Operational Keys (Not DomainError Messages)

NetworthDB uses **two channels** for errors (see the `structured-logging` Cursor rule):

| Channel | Message style | Examples |
| ------- | ------------- | -------- |
| `logger.*` and infra `throw new Error(...)` | Dotted keys | `middleware.error.internal`, `bootstrap.config.env.required.not-found.${name}` |
| `DomainError` subclasses | Human-readable | `"Username is already taken"`, `"Account not found"` |

Do **not** use dotted keys as `DomainError` (or Zod validation hook) client messages. Those strings must be human-readable English.

## Logger Keys

```text
<app-or-package>.<area>.<outcome>
```

- Lowercase segments, kebab-case within segments
- IDs and `Error` instances go in the **context** object, not the key string

```typescript
logger.error("middleware.error.internal", { reason: error.message, error });
logger.info("api.server.listening", { host, port });
```

## Infrastructure Throws

Bootstrap, database invariants, and config parsing:

```typescript
throw new Error(`bootstrap.config.env.required.not-found.${name}`);
throw new Error("database.auth.session.create.error.no-row");
```

## Domain Throws (Human Messages)

```typescript
throw new ValidationError("Opening date is required.", { field: "openingDate" });
throw new EntityNotFoundError("Account not found.", { entityName: "Account", id });
throw new ConflictError("Username is already taken.", { username });
```

Use `code`, `field`, and `context` on `DomainError` for machines — not dotted prose in `message`.

## Package Prefix Hints (Infra Only)

| Source path | Prefix |
| ----------- | ------ |
| `src/packages/bootstrap/` | `bootstrap` |
| `src/packages/database/` | `database` |
| `src/packages/middleware/` | `middleware` |
| `src/packages/notifications/` | `notifications` |
| `src/packages/auth/` | `auth` |
| `src/apps/api/` | `api` |

## Additional Resources

- Infra examples: [examples.md](examples.md)
- Full rule: [`.cursor/rules/structured-logging.mdc`](../../rules/structured-logging.mdc)
