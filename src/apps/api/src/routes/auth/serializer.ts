import type {
  AdvancedRecoveryContext,
  MultifactorChallengeResponse,
  PublicMultifactorState,
  SessionTokenPair,
  User,
  VaultPublicState,
  VaultSlotPublic,
  WebAuthnBeginResponse,
} from "@ndb/core";
import {
  advCtxSchema,
  emptySchema,
  meDetailsSchema,
  messageSchema,
  mfaChallengeSchema,
  recoveryCodeSchema,
  sessionTokenSchema,
  totpBeginSchema,
  userListSchema,
  userSchema,
  vaultSlotSchema,
  vaultSlotsSchema,
  webauthnCredSchema,
  webauthnSessionSchema,
} from "@ndb/platform";

export function serializeSessionTokens(pair: SessionTokenPair) {
  return sessionTokenSchema.parse({
    data: {
      session_token: pair.sessionToken,
      refresh_token: pair.refreshToken,
      expires_in: pair.expiresIn,
    },
    errors: [],
  });
}

export function serializeMfaChallenge(result: MultifactorChallengeResponse) {
  return mfaChallengeSchema.parse({
    data: {
      status: result.status,
      multifactor_token: result.multifactorToken,
      expires_in: result.expiresIn,
      methods: result.methods,
    },
    errors: [],
  });
}

export function serializeUser(user: User) {
  return userSchema.parse({
    data: {
      id: user.id,
      username: user.username.toString(),
      role: user.role,
      multifactor_enabled: user.multifactorEnabled,
      created_at: user.createdAt.toISOString(),
    },
    errors: [],
  });
}

export function serializeVaultSlot(slot: VaultSlotPublic) {
  return vaultSlotSchema.parse({
    data: serializeVaultSlotData(slot),
    errors: [],
  });
}

export function serializeVaultSlotData(slot: VaultSlotPublic) {
  return {
    id: slot.id,
    slot_type: slot.slotType,
    salt: slot.salt,
    wrap_blob: slot.wrapBlob,
    credential_id: slot.credentialId,
    label: slot.label,
  };
}

export function serializeMeDetails(
  user: User,
  vault: VaultPublicState,
  multifactorState: PublicMultifactorState
) {
  return meDetailsSchema.parse({
    data: {
      id: user.id,
      username: user.username.toString(),
      role: user.role,
      multifactor_enabled: user.multifactorEnabled,
      multifactor_methods: multifactorState.multifactorMethods,
      recovery_codes_enabled: multifactorState.recoveryCodesEnabled,
      recovery_email_enabled: user.hasRecoveryEmail(),
      recovery_email_set_at: user.recoveryEmailSetAt?.toISOString() ?? null,
      vault_initialized: vault.vaultInitialized,
      vault_slots: vault.vaultSlots.map(serializeVaultSlotData),
      display_name: vault.displayName,
    },
    errors: [],
  });
}

export function serializeEmpty() {
  return emptySchema.parse({ data: null, errors: [] });
}

export function serializeMessage(message: string) {
  return messageSchema.parse({ data: { message }, errors: [] });
}

export function serializeWebauthnSession(
  sessionId: string,
  options: WebAuthnBeginResponse["options"]
) {
  return webauthnSessionSchema.parse({
    data: { session_id: sessionId, options },
    errors: [],
  });
}

export function serializeTotpBegin(uri: string) {
  return totpBeginSchema.parse({ data: { uri }, errors: [] });
}

export function serializeRecoveryCodes(codes: string[]) {
  return recoveryCodeSchema.parse({ data: { recovery_codes: codes }, errors: [] });
}

export function serializeAdvCtx(context: AdvancedRecoveryContext) {
  return advCtxSchema.parse({
    data: {
      vault_initialized: context.vault.initialize,
      vault_slots: context.vault.slots.map(serializeVaultSlotData),
      vault_recovery_methods: context.vault.recoveryMethods,
    },
    errors: [],
  });
}

export function serializeVaultSlots(slots: VaultSlotPublic[]) {
  return vaultSlotsSchema.parse({
    data: { vault_slots: slots.map(serializeVaultSlotData) },
    errors: [],
  });
}

export function serializeWebauthnCreds(
  items: { id: string; name: string; createdAt: Date }[],
  total: number
) {
  return webauthnCredSchema.parse({
    data: {
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        created_at: item.createdAt.toISOString(),
      })),
      total,
    },
    errors: [],
  });
}

export function serializeUserList(items: User[], total: number) {
  return userListSchema.parse({
    data: {
      items: items.map((item) => serializeUser(item).data),
      total,
    },
    errors: [],
  });
}
