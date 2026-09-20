# Dotted Operational Key Examples

Use these for **logs and infra `Error` only** — not for `DomainError` client messages.

---

## Bootstrap

```typescript
throw new Error(`bootstrap.config.env.required.not-found.${name}`);
throw new Error(`bootstrap.config.env.invalid-port.value.${value}`);
throw new Error("bootstrap.config.notifications.email-smtp.required");
```

---

## Database (Invariants)

```typescript
throw new Error("database.auth.session.create.error.no-row");
throw new Error("database.user.save.error.no-row");
throw new Error("database.user.delete.invalid.missing-id-filter");
```

---

## Middleware

```typescript
throw new UnauthorizedError("Additional authentication is required.");
```

---

## Logger

```typescript
logger.warn("middleware.error.client", { method, path, status, code });
logger.error("middleware.error.internal", { reason: error.message, error });
```

---

## Domain (Human — Do Not Dotted)

```typescript
// GOOD (target style)
throw new ValidationError("Bank name is required.", { field: "bank" });
throw new ConflictError("Username is already taken.", { username });

// BAD for client-facing DomainError
throw new ValidationError("core.account.bank.invalid.required", { field: "bank" });
```
