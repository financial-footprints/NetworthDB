import type { AuthUser, MeResponse } from "@web/utils/api/endpoints/auth/types";
import { hasE2EEVault, openField } from "@web/utils/crypto/vault";

/**
 * Decrypt display name when the vault DEK is already available.
 */
export async function decryptDisplayName(me: MeResponse, dek: CryptoKey): Promise<string | null> {
  if (!hasE2EEVault(me.vault_initialized) || !me.display_name) {
    return null;
  }

  try {
    return await openField(dek, me.display_name);
  } catch {
    return null;
  }
}

export function meToAuthUser(me: MeResponse, name: string | null): AuthUser {
  return {
    id: me.id,
    username: me.username,
    role: me.role,
    multifactor_enabled: me.multifactor_enabled,
    multifactor_methods: me.multifactor_methods,
    recovery_codes_enabled: me.recovery_codes_enabled,
    recovery_email_enabled: me.recovery_email_enabled,
    displayName: name,
  };
}
