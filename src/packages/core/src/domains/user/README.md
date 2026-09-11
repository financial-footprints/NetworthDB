# User domain

Identity and account administration bounded context.

## Layout

| Path                                                                 | Contents                                                                       |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `[entities/user/](entities/user/)`                                   | `User` aggregate with co-located `Username`, `DisplayName`, and `TotpState` |
| `[helpers.ts](helpers.ts)`                                           | Roles, access guards, list query/result types                                  |
| `[repositories/user-repository.ts](repositories/user-repository.ts)` | User persistence port + `UserFilters`                                          |
| `[services/user-service.ts](services/user-service.ts)`               | Register, list, patch, change password                                         |

## Feature modules (`modules/`)

| Module                                      | Role                                     |
| ------------------------------------------- | ---------------------------------------- |
| `[modules/vault/](modules/vault/README.md)` | Vault slot entities, wrap wire format, persistence port |

## Dependencies

- `user-service` uses `assertAal2` from `auth` and a `SessionRevoker` hook (implemented by `@ndb/auth`) after admin edits.
- `modules/vault/` holds slot entities, repository ports, and `VaultService`.
