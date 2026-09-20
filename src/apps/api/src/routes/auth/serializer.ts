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
  meDetailsSchema,
  messageSchema,
  mfaChallengeSchema,
  nullableSessionResponseSchema,
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
      sessionToken: pair.sessionToken,
      refreshToken: pair.refreshToken,
      expiresIn: pair.expiresIn,
    },
  });
}

export function serializeNullableSessionResponse() {
  return nullableSessionResponseSchema.parse({ data: null });
}

export function serializeMfaChallenge(result: MultifactorChallengeResponse) {
  return mfaChallengeSchema.parse({
    data: {
      status: result.status,
      multifactorToken: result.multifactorToken,
      expiresIn: result.expiresIn,
      methods: result.methods,
    },
  });
}

export function serializeUser(user: User) {
  return userSchema.parse({ data: serializeUserData(user) });
}

export function serializeVaultSlot(slot: VaultSlotPublic) {
  return vaultSlotSchema.parse({
    data: serializeVaultSlotData(slot),
  });
}

function serializeVaultSlotData(slot: VaultSlotPublic) {
  return {
    id: slot.id,
    slotType: slot.slotType,
    salt: slot.salt,
    wrapBlob: slot.wrapBlob,
    credentialId: slot.credentialId,
    label: slot.label,
  };
}

export function serializeMeDetails(
  user: User,
  vault: VaultPublicState,
  multifactorState: PublicMultifactorState,
  clientSettings: Record<string, unknown> | null
) {
  return meDetailsSchema.parse({
    data: {
      id: user.id,
      username: user.username.toString(),
      role: user.role,
      multifactorEnabled: user.multifactorEnabled,
      multifactorMethods: multifactorState.multifactorMethods,
      recoveryCodesEnabled: multifactorState.recoveryCodesEnabled,
      recoveryEmailEnabled: user.hasRecoveryEmail(),
      recoveryEmailSetAt: user.recoveryEmailSetAt?.toISOString() ?? null,
      vaultInitialized: vault.vaultInitialized,
      vaultSlots: vault.vaultSlots.map(serializeVaultSlotData),
      displayName: user.displayName?.toString() ?? null,
      clientSettings,
    },
  });
}

export function serializeMessage(message: string) {
  return messageSchema.parse({ data: { message } });
}

export function serializeWebauthnSession(
  sessionId: string,
  options: WebAuthnBeginResponse["options"]
) {
  return webauthnSessionSchema.parse({
    data: { sessionId, options },
  });
}

export function serializeTotpBegin(uri: string) {
  return totpBeginSchema.parse({ data: { uri } });
}

export function serializeRecoveryCodes(codes: string[]) {
  return recoveryCodeSchema.parse({ data: { recoveryCodes: codes } });
}

export function serializeAdvancedContext(context: AdvancedRecoveryContext) {
  return advCtxSchema.parse({
    data: {
      vaultInitialized: context.vault.initialize,
      vaultSlots: context.vault.slots.map(serializeVaultSlotData),
      vaultRecoveryMethods: context.vault.recoveryMethods,
    },
  });
}

export function serializeVaultSlots(slots: VaultSlotPublic[]) {
  return vaultSlotsSchema.parse({
    data: { vaultSlots: slots.map(serializeVaultSlotData) },
  });
}

export function serializeWebauthnCreds(
  items: { id: string; name: string; createdAt: Date }[],
  total: number
) {
  return webauthnCredSchema.parse({
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      createdAt: item.createdAt.toISOString(),
    })),
    total,
  });
}

function serializeUserData(user: User) {
  return {
    id: user.id,
    username: user.username.toString(),
    role: user.role,
    multifactorEnabled: user.multifactorEnabled,
    createdAt: user.createdAt.toISOString(),
  };
}

export function serializeUserList(items: User[], total: number) {
  return userListSchema.parse({
    items: items.map((item) => serializeUserData(item)),
    total,
  });
}
