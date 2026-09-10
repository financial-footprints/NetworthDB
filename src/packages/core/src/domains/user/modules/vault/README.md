# User vault module

User-owned E2EE vault slots. Persisted in `users_vault` (see `packages/database/src/schema/users/vault.ts`).

## Layout

| Path | Contents |
| --- | --- |
| [`embedded/vault-wrap.ts`](embedded/vault-wrap.ts) | Slot crypto, blob packing, validation |
| [`entities/vault-slot.ts`](entities/vault-slot.ts) | `VaultSlot` |
| [`repositories/vault-slot-repository.ts`](repositories/vault-slot-repository.ts) | Vault slot persistence port |
| [`services/vault-service.ts`](services/vault-service.ts) | Initialize, add, rotate, delete slots |
| [`types.ts`](types.ts) | `VaultSlotInput`, `VaultPublicState`, etc. |

## Cross-domain dependency

`VaultService` depends on `auth/modules/webauthn/WebAuthnCredentialRepository` to validate PRF slots against registered credentials. Composition injects `VaultService` into AuthService; HTTP uses `services.vault`.
