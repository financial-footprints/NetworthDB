# Domain Bounded Contexts

Organize domain code by bounded context under `src/domains/<name>/`:

- `entities/` — domain entities and value objects
- `repositories/` — repository ports (interfaces); filter types live in the same file as the port
- `services/` — application services and use cases
- `embedded/` — pure protocol logic with no I/O

Cross-cutting domain errors live in `src/shared/errors/`.

Infrastructure (Postgres, HTTP, NAPI) stays out of this package.

## Submodule Rules

Use **sibling modules** when concerns are peers within the same bounded context (e.g. `auth/modules/multifactor/`, `auth/modules/recovery/`, `auth/modules/webauthn/`).

Use an **owner submodule** when one aggregate owns another (e.g. `user/modules/vault/` — `VaultSlot` belongs to `User`).

Each submodule follows the same folder roles (`entities/`, `repositories/`, `services/`, `embedded/`, `index.ts`).

Within a bounded context, place optional feature modules under `modules/<name>/` (for example `auth/modules/multifactor/`). Root-level files such as `constants.ts`, shared `entities/`, and top-level `services/` hold cross-module concerns; feature-specific code stays inside the matching `modules/<name>/` tree.

## Active Domains

| Domain                    | Role                                                                      |
| ------------------------- | ------------------------------------------------------------------------- |
| [`user/`](user/README.md) | Identity, roles, admin operations; owns E2EE vault slots                  |
| [`auth/`](auth/README.md) | Sessions, multifactor, recovery, WebAuthn; `AuthService` owns the context |

Public API flows through each domain's `index.ts` → `packages/core/src/index.ts` (`@ndb/core`).
