# ADR-001: Domain-Driven Design and Clean Architecture

## Status

Accepted

## Context

NetworthDB owns account metadata, authentication, statement processing, and background jobs. Business rules must stay independent of HTTP, databases, and third-party integrations. Dependencies must point inward: outer layers depend on the domain, never the reverse.

## Decision

Adopt **Domain-Driven Design** with **Clean Architecture**. The domain package (`@ndb/core`) sits at the center; apps and infrastructure adapters wrap it.

```mermaid
flowchart TB
  subgraph apps [Apps]
    API[HTTP API]
    Web[Web UI]
  end

  subgraph composition [Composition]
    Bootstrap[@ndb/bootstrap]
    Platform[@ndb/platform]
  end

  subgraph domain [Domain center]
    Core[@ndb/core]
  end

  subgraph infra [Infrastructure]
    DB[@ndb/database]
    Stmt[@ndb/statements]
    Auth[@ndb/auth]
    MW[@ndb/middleware]
  end

  API --> Bootstrap
  Web --> Platform
  Bootstrap --> Core
  Bootstrap --> DB
  Bootstrap --> Stmt
  Bootstrap --> Auth
  DB --> Core
  Stmt --> Core
  Auth --> Core
  API --> MW
```

### Bounded Contexts

```mermaid
flowchart LR
  User[User]
  Auth[Auth / Vault]
  Account[Account]
  Sources[Sources]
  Stmt[Statements]
  Jobs[Jobs]

  Account --> Stmt
  Account --> Jobs
  Account --> Sources
  User --> Auth
  Auth --> User
```

| Context | Scope |
| ------- | ----- |
| User | Identity and profile |
| Auth / Vault | Login, MFA, sessions, recovery, vault slots |
| Account | Account metadata and statement orchestration |
| Sources | Mail and statement source configuration |
| Statements | Vault-backed statement artifacts (no SQL entity for individual statements) |
| Jobs | Background work tied to accounts and pipelines |

### Dependency Rules

- Apps depend on bootstrap and platform schemas, not on adapter internals.
- Domain does not import persistence, HTTP, or compute packages.
- Bootstrap wires port implementations; cross-cutting HTTP concerns stay in middleware.

## Consequences

### Positive

- Business rules are testable without HTTP or a database.
- Adapters (storage, compute, auth) can be swapped behind ports.

### Negative

- Shared type changes start in the domain and propagate to adapters.
- More packages and explicit wiring than a monolith.

### Neutral

- API request/response shapes are defined separately from domain entities and mapped at the boundary.

## References

- [ADR-002](002-authentication.md) — auth bounded context
- [ADR-004](004-data-encryption-policy.md) — field classification
- [ADR-005](005-statements-compute.md) — statement compute
