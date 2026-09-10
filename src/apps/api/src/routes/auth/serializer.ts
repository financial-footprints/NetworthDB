import type {
  MultifactorChallengeResponse,
  PublicUser,
  SessionTokenPair,
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
  publicUserListSchema,
  publicUserSchema,
  recoveryCodeSchema,
  sessionTokenSchema,
  totpBeginSchema,
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
      token_type: pair.tokenType,
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

export function serializePublicUser(user: PublicUser) {
  return publicUserSchema.parse({
    data: {
      id: user.id,
      username: user.username,
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

export function serializeMeDetails(user: PublicUser, vault: VaultPublicState) {
  return meDetailsSchema.parse({
    data: {
      id: user.id,
      username: user.username,
      role: user.role,
      multifactor_enabled: user.multifactorEnabled,
      multifactor_methods: user.multifactorMethods,
      recovery_codes_enabled: user.recoveryCodesEnabled,
      recovery_email_enabled: user.recoveryEmailEnabled,
      recovery_email_set_at: user.recoveryEmailSetAt?.toISOString() ?? null,
      e2ee_vault_initialized: vault.e2eeVaultInitialized,
      e2ee_slots: vault.e2eeSlots.map(serializeVaultSlotData),
      e2ee_name: vault.e2eeName,
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

export function serializeAdvCtx(context: {
  e2eeVaultInitialized: boolean;
  e2eeSlots: VaultSlotPublic[];
  vaultRecoveryMethods: string[];
}) {
  return advCtxSchema.parse({
    data: {
      e2ee_vault_initialized: context.e2eeVaultInitialized,
      e2ee_slots: context.e2eeSlots.map(serializeVaultSlotData),
      vault_recovery_methods: context.vaultRecoveryMethods,
    },
    errors: [],
  });
}

export function serializeVaultSlots(slots: VaultSlotPublic[]) {
  return vaultSlotsSchema.parse({
    data: { e2ee_slots: slots.map(serializeVaultSlotData) },
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

export function serializePublicUserList(items: PublicUser[], total: number) {
  return publicUserListSchema.parse({
    data: {
      items: items.map((user) => serializePublicUser(user).data),
      total,
    },
    errors: [],
  });
}
