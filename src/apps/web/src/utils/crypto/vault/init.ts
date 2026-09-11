import { getMe, initializeVault } from "@web/utils/api/endpoints/auth";
import type { MeResponse } from "@web/utils/api/endpoints/auth/types";
import { writeDEK } from "@web/utils/crypto/session";
import { hasE2EEVault } from "@web/utils/crypto/vault/fields";
import { createVault } from "@web/utils/crypto/vault/slots";

export async function ensureVaultAtLogin(
  sessionToken: string,
  me: MeResponse,
  password: string
): Promise<MeResponse> {
  if (hasE2EEVault(me.vault_initialized)) {
    return me;
  }

  const created = await createVault(password);
  await initializeVault(sessionToken, {
    slots: [
      {
        slot_type: "password",
        salt: created.slots[0]?.salt ?? "",
        wrap_blob: created.slots[0]?.wrap_blob ?? "",
        password,
      },
    ],
  });
  await writeDEK(created.dek);
  return getMe(sessionToken);
}
