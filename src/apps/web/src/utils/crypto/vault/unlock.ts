import { fetchMe, initializeVault } from "@web/utils/api/routes/auth";
import type { MeResponse } from "@web/utils/api/routes/auth/types";
import { readDEK, writeDEK } from "@web/utils/crypto/session";
import {
  createVault,
  credentialIdsMatch,
  findPasswordSlot,
  unwrapDEKFromSlot,
} from "@web/utils/crypto/vault/slots";
import type {
  AutoUnlockResult,
  UnlockContext,
  UnlockMethod,
  VaultSlot,
  VaultSlotMaterial,
} from "@web/utils/crypto/vault/types";

export function listUnlockMethods(slots: VaultSlotMaterial[]): UnlockMethod[] {
  const methods: UnlockMethod[] = [];
  if (findPasswordSlot(slots)) {
    methods.push("password");
  }
  if (slots.some((slot) => slot.slotType === "recovery_phrase")) {
    methods.push("recovery_phrase");
  }
  if (slots.some((slot) => slot.slotType === "webauthn_prf")) {
    methods.push("webauthn");
  }
  return methods;
}

async function unlockVaultFromSlots(
  slots: VaultSlotMaterial[],
  ctx: UnlockContext
): Promise<CryptoKey> {
  if (ctx.password) {
    const passwordSlot = findPasswordSlot(slots);
    if (passwordSlot) {
      try {
        return await unwrapDEKFromSlot(passwordSlot, ctx.password);
      } catch {
        // try other slots
      }
    }
  }
  if (ctx.recoveryPhrase) {
    for (const slot of slots.filter((entry) => entry.slotType === "recovery_phrase")) {
      try {
        return await unwrapDEKFromSlot(slot, ctx.recoveryPhrase);
      } catch {
        // try next phrase slot
      }
    }
  }
  throw new Error("vault locked");
}

async function unlockWithWebAuthnPRF(
  slots: VaultSlot[],
  credentialId: string,
  prfOutput: Uint8Array
): Promise<CryptoKey> {
  const slot = slots.find(
    (entry) =>
      entry.slotType === "webauthn_prf" && credentialIdsMatch(entry.credentialId, credentialId)
  );
  if (!slot) {
    throw new Error("vault locked");
  }
  return unwrapDEKFromSlot(slot, prfOutput);
}

export async function unlockVault(
  password: string,
  slots: VaultSlotMaterial[]
): Promise<CryptoKey> {
  return unlockVaultFromSlots(slots, { password });
}

export async function tryAutoUnlock(me: MeResponse, ctx: UnlockContext): Promise<AutoUnlockResult> {
  if (!me.vaultInitialized) {
    return { kind: "no_vault" };
  }

  const slots = me.vaultSlots;
  const existingDek = await readDEK();
  if (existingDek) {
    return { kind: "unlocked", dek: existingDek };
  }

  if (ctx.password && findPasswordSlot(slots)) {
    try {
      const dek = await unlockVaultFromSlots(slots, { password: ctx.password });
      return { kind: "unlocked", dek };
    } catch {
      // fall through
    }
  }

  if (ctx.webauthn) {
    try {
      const dek = await unlockWithWebAuthnPRF(
        slots,
        ctx.webauthn.credentialId,
        ctx.webauthn.prfOutput
      );
      return { kind: "unlocked", dek };
    } catch {
      // fall through
    }
  }

  const methods = listUnlockMethods(slots);
  if (methods.length === 0) {
    return { kind: "no_vault" };
  }
  return { kind: "manual_required", methods };
}

export async function unlockVaultManual(
  slots: VaultSlotMaterial[],
  ctx: UnlockContext
): Promise<CryptoKey> {
  if (ctx.webauthn) {
    return unlockWithWebAuthnPRF(
      slots as VaultSlot[],
      ctx.webauthn.credentialId,
      ctx.webauthn.prfOutput
    );
  }
  return unlockVaultFromSlots(slots, {
    password: ctx.password,
    recoveryPhrase: ctx.recoveryPhrase,
  });
}

export async function ensureVaultAtLogin(
  sessionToken: string,
  me: MeResponse,
  password: string
): Promise<MeResponse> {
  if (me.vaultInitialized) {
    return me;
  }

  const created = await createVault(password);
  await initializeVault(sessionToken, {
    displayName: undefined,
    slots: [
      {
        slotType: "password",
        salt: created.slots[0]?.salt ?? "",
        wrapBlob: created.slots[0]?.wrapBlob ?? "",
        password,
      },
    ],
  });
  await writeDEK(created.dek);
  return fetchMe(sessionToken);
}
