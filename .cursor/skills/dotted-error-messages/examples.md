# Dotted Error Message Examples

Before/after conversions grouped by package. Use these as templates when migrating throws.

---

## Bootstrap (`bootstrap`)

Already largely migrated. Remaining plain messages should follow the same pattern.

| Before | After |
|--------|-------|
| `throw new Error(\`Invalid database environment variables: ${fields}\`)` | `throw new Error(\`bootstrap.config.env.invalid.fields.${fields}\`)` |
| `throw new Error("email.smtp is required when email channel is smtp")` | `throw new Error("bootstrap.config.notifications.email-smtp.required")` |

**Already correct:**

```typescript
throw new Error(`bootstrap.config.env.required.not-found.${name}`);
throw new Error(`bootstrap.config.env.invalid-port.value.${value}`);
throw new Error(`bootstrap.config.env.invalid-log-level.value.${value}`);
throw new Error("bootstrap.config.env.required.not-found.MFA_SECRET");
throw new Error("bootstrap.config.env.auth-rate-window.must-be-positive");
```

---

## Database (`database`)

### Repositories — ConflictError / Plain Error

| Before | After |
|--------|-------|
| `throw new ConflictError("username taken", { username })` | `throw new ConflictError("database.user.create.conflict.username-taken", { username })` |
| `throw new ConflictError("duplicate slot")` | `throw new ConflictError("database.vault.slot.create.conflict.duplicate")` |
| `throw new Error("session insert returned no row")` | `throw new Error("database.auth.session.create.error.no-row")` |
| `throw new Error("session update returned no row")` | `throw new Error("database.auth.session.save.error.no-row")` |
| `throw new Error("user insert returned no row")` | `throw new Error("database.user.create.error.no-row")` |
| `throw new Error("user update returned no row")` | `throw new Error("database.user.save.error.no-row")` |
| `throw new Error("user delete requires id filter")` | `throw new Error("database.user.delete.invalid.missing-id-filter")` |
| `throw new Error("mfa challenge insert returned no row")` | `throw new Error("database.auth.mfa-challenge.create.error.no-row")` |
| `throw new Error("mfa challenge update returned no row")` | `throw new Error("database.auth.mfa-challenge.save.error.no-row")` |
| `throw new Error("webauthn credential insert returned no row")` | `throw new Error("database.auth.webauthn-credential.create.error.no-row")` |
| `throw new Error("webauthn session insert returned no row")` | `throw new Error("database.auth.webauthn-session.create.error.no-row")` |
| `throw new Error("vault slot insert returned no row")` | `throw new Error("database.vault.slot.create.error.no-row")` |
| `` throw new Error(`invalid vault slot type ${row.slotType}`) `` | `` throw new Error(`database.vault.slot.map.invalid.type.${row.slotType}`) `` |
| `throw new Error("database.auth.recovery-challenge.insert-no-row")` | `throw new Error("database.auth.recovery-challenge.create.error.no-row")` |

**Already correct:**

```typescript
throw new ConflictError("database.auth.session.create.error.hash-collision");
throw new Error("database.auth.recovery-code.create.error.no-row");
throw new Error("database.auth.recovery-code.save.error.no-row");
```

### Config / Env

| Before | After |
|--------|-------|
| `` throw new Error(`Invalid database environment variables: ${fields}`) `` | `` throw new Error(`database.config.env.invalid.fields.${fields}`) `` |

---

## Core (`core`)

### Auth Service

| Before | After |
|--------|-------|
| `throw new UnauthorizedError("invalid credentials")` | `throw new UnauthorizedError("core.auth.login.unauthorized.invalid-credentials")` |
| `throw new UnauthorizedError("Invalid username or password")` | `throw new UnauthorizedError("core.auth.login.unauthorized.invalid-credentials")` |
| `throw new UnauthorizedError("Invalid or expired refresh token")` | `throw new UnauthorizedError("core.auth.refresh.unauthorized.invalid-token")` |
| `throw new UnauthorizedError("Invalid or expired session")` | `throw new UnauthorizedError("core.auth.session.unauthorized.invalid-or-expired")` |
| `throw new ValidationError("username unchanged")` | `throw new ValidationError("core.auth.username.invalid.unchanged")` |
| `throw new ConflictError("username taken", { username })` | `throw new ConflictError("core.auth.username.conflict.taken", { username })` |

### MFA Service

| Before | After |
|--------|-------|
| `throw new ValidationError("mfa not enabled")` | `throw new ValidationError("core.auth.mfa.invalid.not-enabled")` |
| `throw new ValidationError("recovery codes not enrolled")` | `throw new ValidationError("core.auth.mfa.invalid.recovery-codes-not-enrolled")` |
| `throw new ValidationError("exactly one MFA proof required")` | `throw new ValidationError("core.auth.mfa.verify.invalid.proof-count")` |
| `throw new ValidationError("TOTP not started")` | `throw new ValidationError("core.auth.mfa.totp.invalid.not-started")` |
| `throw new UnauthorizedError("invalid code")` | `throw new UnauthorizedError("core.auth.mfa.totp.unauthorized.invalid-code")` |
| `throw new UnauthorizedError("code from previous authenticator")` | `throw new UnauthorizedError("core.auth.mfa.totp.unauthorized.stale-code")` |
| `throw new ValidationError("cannot disable last mfa method")` | `throw new ValidationError("core.auth.mfa.disable.invalid.last-method")` |
| `throw new ValidationError("MFA proof required")` | `throw new ValidationError("core.auth.mfa.verify.invalid.proof-required")` |
| `throw new ValidationError("webauthn not configured")` | `throw new ValidationError("core.auth.mfa.webauthn.invalid.not-configured")` |
| `throw new ValidationError("password required", { field: "password" })` | `throw new ValidationError("core.auth.mfa.invalid.password-required", { field: "password" })` |

### Vault Service

| Before | After |
|--------|-------|
| `throw new ValidationError("at least one slot required")` | `throw new ValidationError("core.auth.vault.initialize.invalid.no-slots")` |
| `throw new ConflictError("vault already initialized")` | `throw new ConflictError("core.auth.vault.initialize.conflict.already-initialized")` |
| `throw new ConflictError("vault not initialized")` | `throw new ConflictError("core.auth.vault.invalid.not-initialized")` |
| `throw new ConflictError("cannot delete last vault slot")` | `throw new ConflictError("core.auth.vault.slot.delete.conflict.last-slot")` |
| `throw new UnauthorizedError("vault slot authorization failed")` | `throw new UnauthorizedError("core.auth.vault.slot.unauthorized.failed")` |
| `throw new ConflictError("credential is the only vault decryption key")` | `throw new ConflictError("core.auth.vault.credential.delete.conflict.only-decryption-key")` |
| `throw new ValidationError("invalid slot type")` | `throw new ValidationError("core.auth.vault.slot.invalid.type")` |
| `throw new ConflictError("duplicate slot")` | `throw new ConflictError("core.auth.vault.slot.conflict.duplicate")` |
| `throw new EntityNotFoundError("VaultSlot", slotIdRaw)` | `throw new EntityNotFoundError("core.auth.vault.slot.not-found", slotIdRaw)` *(after constructor refactor)* |

### WebAuthn Service

| Before | After |
|--------|-------|
| `throw new UnauthorizedError("webauthn verification failed")` | `throw new UnauthorizedError("core.auth.webauthn.verify.unauthorized.failed")` |
| `throw new ValidationError("webauthn not enrolled")` | `throw new ValidationError("core.auth.webauthn.invalid.not-enrolled")` |
| `throw new ValidationError("no vault passkey available")` | `throw new ValidationError("core.auth.webauthn.vault.invalid.no-passkey")` |
| `throw new ValidationError("invalid session")` | `throw new ValidationError("core.auth.webauthn.session.invalid")` |
| `throw new ValidationError("webauthn not configured")` | `throw new ValidationError("core.auth.webauthn.invalid.not-configured")` |
| `throw new EntityNotFoundError("WebAuthnCredential", credentialIdRaw)` | `throw new EntityNotFoundError("core.auth.webauthn.credential.not-found", credentialIdRaw)` *(after constructor refactor)* |

### Recovery Service

| Before | After |
|--------|-------|
| `throw new ValidationError("token and new_password required")` | `throw new ValidationError("core.auth.recovery.complete.invalid.missing-fields")` |
| `throw new ValidationError("invalid or expired token")` | `throw new ValidationError("core.auth.recovery.invalid.expired-token")` |
| `throw new ValidationError("password_slot required")` | `throw new ValidationError("core.auth.recovery.advanced.invalid.password-slot-required")` |
| `throw new ValidationError("username and email required")` | `throw new ValidationError("core.auth.recovery.email.invalid.missing-fields")` |

### User Service / Entities

| Before | After |
|--------|-------|
| `throw new ValidationError("at least one of username or role is required")` | `throw new ValidationError("core.user.patch.invalid.no-fields")` |
| `throw new ValidationError("cannot change your own role")` | `throw new ValidationError("core.user.role.invalid.self-change")` |
| `throw new ValidationError("cannot delete yourself")` | `throw new ValidationError("core.user.delete.invalid.self-delete")` |
| `throw new ConflictError("username taken", { username })` | `throw new ConflictError("core.user.register.conflict.username-taken", { username })` |
| `throw new ValidationError("unknown role", { field: "role", value: raw })` | `throw new ValidationError("core.user.role.invalid.unknown", { field: "role", value: raw })` |

### Auth Context

| Before | After |
|--------|-------|
| `throw new UnauthorizedError("mfa step-up required")` | `throw new UnauthorizedError("core.auth.context.unauthorized.mfa-step-up-required")` |

---

## Middleware (`middleware`)

| Before | After |
|--------|-------|
| `throw new UnauthorizedError()` | `throw new UnauthorizedError("middleware.auth.bearer.unauthorized.missing")` |
| `throw new TooManyRequestsError()` | `throw new TooManyRequestsError("middleware.auth.ratelimit.error.too-many-requests")` |

**Already correct:**

```typescript
throw new UnauthorizedError("middleware.auth.mfa.bearer-not-challenge");
```

---

## API (`api`)

Route-level validation in `src/apps/api/src/routes/auth.ts`:

| Before | After |
|--------|-------|
| `throw new ValidationError("request body must be an object")` | `throw new ValidationError("api.auth.parse-body.invalid.not-object")` |
| `throw new ValidationError("username required", { field: "username" })` | `throw new ValidationError("api.auth.login.invalid.username-required", { field: "username" })` |
| `throw new ValidationError("password required", { field: "password" })` | `throw new ValidationError("api.auth.login.invalid.password-required", { field: "password" })` |
| `throw new ValidationError("refresh_token required", { field: "refresh_token" })` | `throw new ValidationError("api.auth.refresh.invalid.token-required", { field: "refresh_token" })` |
| `throw new ValidationError("no fields to update")` | `throw new ValidationError("api.auth.account.patch.invalid.no-fields")` |
| `throw new ValidationError("totp required", { field: "totp" })` | `throw new ValidationError("api.auth.mfa.totp.invalid.required", { field: "totp" })` |
| `throw new ValidationError("code required", { field: "code" })` | `throw new ValidationError("api.auth.mfa.verify.invalid.code-required", { field: "code" })` |
| `throw new ValidationError("invalid pagination value")` | `throw new ValidationError("api.auth.admin.users.invalid.pagination")` |
| `throw new ValidationError("at least one slot required")` | `throw new ValidationError("api.auth.vault.initialize.invalid.no-slots")` |
| `throw new ValidationError("invalid slot")` | `throw new ValidationError("api.auth.vault.slot.invalid")` |
| `throw new ValidationError("invalid slot type")` | `throw new ValidationError("api.auth.vault.slot.invalid.type")` |
| `throw new ValidationError("email required", { field: "email" })` | `throw new ValidationError("api.auth.recovery.email.invalid.required", { field: "email" })` |
| `throw new ValidationError("provide totp or recovery_code, not both")` | `throw new ValidationError("api.auth.mfa.verify.invalid.multiple-proofs")` |
| `throw new ValidationError("totp or recovery_code required")` | `throw new ValidationError("api.auth.mfa.verify.invalid.proof-required")` |
| `throw new ValidationError("current_password required", { field: "current_password" })` | `throw new ValidationError("api.auth.account.password.invalid.current-required", { field: "current_password" })` |

---

## Notifications (`notifications`)

**Already correct:**

```typescript
throw new DomainError("notifications.email.smtp.send.error", {
  code: "internal",
  cause: cause instanceof Error ? cause : undefined,
});
```

---

## Test Helpers (Lower Priority)

Optional migration — not required for production correctness.

| Before | After (optional) |
|--------|------------------|
| `throw new Error("database client was not created")` | `throw new Error("test.database.client.error.not-created")` |
| `throw new ConflictError("session hash collision")` | `throw new ConflictError("test.auth.session.create.conflict.hash-collision")` |
| `throw new Error("missing secret")` | `throw new Error("test.auth.mfa.error.missing-secret")` |

---

## Consistency Notes

1. **Same semantic error, same key** — `"invalid credentials"` in login, MFA verify, and recovery should share one key when the meaning is identical: `core.auth.login.unauthorized.invalid-credentials` or a shared `core.auth.unauthorized.invalid-credentials` if truly global.
2. **Layer-specific keys** — API route validation uses `api.*`; domain logic uses `core.*`; persistence uses `database.*`. Do not reuse `core.*` in API parse helpers.
3. **Dynamic final segment** — bootstrap pattern: append raw values only when they aid debugging (env var names, invalid values). Avoid user PII in message keys.
4. **Keep context** — `{ field: "username" }`, `{ username }`, etc. stay in constructor options; only the message string changes.
