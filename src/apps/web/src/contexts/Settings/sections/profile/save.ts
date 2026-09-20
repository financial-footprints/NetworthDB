import type { SecurityConfirmResult } from "@web/contexts/Settings/modals/security/Confirm";
import {
  clearRecoveryEmail,
  fetchMe,
  patchMeWithToken,
  setRecoveryEmail,
  withSessionToken,
} from "@web/utils/api/routes/auth";
import type {
  AuthUser,
  MeResponse,
  PatchMePayload,
  TokenPair,
} from "@web/utils/api/routes/auth/types";
import { ApiError } from "@web/utils/api/types";
import {
  isE2eeEnabled,
  parseClientSettings,
  resolveStoredField,
} from "@web/utils/crypto/client-settings";
import { readDEK } from "@web/utils/crypto/session";
import { unlockVault } from "@web/utils/crypto/vault";
import { errorMessage } from "@web/utils/errors";

export type ProfileSaveIntent = {
  trimmedName: string;
  trimmedUsername: string;
  trimmedRecovery: string;
  usernameChanged: boolean;
  nameChanged: boolean;
  wantsRecovery: boolean;
  confirmedPassword?: string;
  needsSecurity: boolean;
  needsMfaForRecovery: boolean;
  needsMfaInput: boolean;
  needsProfileNetwork: boolean;
};

export function resolveProfileSaveIntent(
  user: AuthUser,
  name: string,
  username: string,
  recoveryEmail: string,
  security?: SecurityConfirmResult,
  vaultPassword?: string
): ProfileSaveIntent {
  const trimmedName = name.trim();
  const trimmedUsername = username.trim();
  const trimmedRecovery = recoveryEmail.trim();
  const usernameChanged = trimmedUsername !== user.username;
  const nameChanged = trimmedName !== (user.displayName ?? "");
  const wantsRecovery = trimmedRecovery.length > 0;
  const confirmedPassword = security?.password ?? vaultPassword;
  const needsSecurity = usernameChanged || wantsRecovery;
  const needsMfaForRecovery = wantsRecovery && user.multifactorEnabled;
  const needsMfaInput = needsMfaForRecovery && !security?.totp && !security?.recoveryCode;

  return {
    trimmedName,
    trimmedUsername,
    trimmedRecovery,
    usernameChanged,
    nameChanged,
    wantsRecovery,
    confirmedPassword,
    needsSecurity,
    needsMfaForRecovery,
    needsMfaInput,
    needsProfileNetwork: nameChanged || usernameChanged,
  };
}

type ProfileVaultContext = {
  vaultExists: boolean;
  dek: CryptoKey | null;
};

async function resolveProfileVaultContext(
  sessionToken: string,
  intent: ProfileSaveIntent,
  completeVaultUnlock: (dek: CryptoKey, me?: MeResponse) => Promise<void>,
  vaultPassword?: string,
  dekInSession?: CryptoKey | null
): Promise<ProfileVaultContext | "password_required"> {
  const me = await fetchMe(sessionToken);
  const vaultExists = Boolean(me.vaultInitialized);
  const e2eeNameEnabled = isE2eeEnabled(
    parseClientSettings(me.clientSettings ?? null),
    "display_name"
  );
  let dek = dekInSession ?? null;
  const vaultNeedsPassword =
    intent.nameChanged && e2eeNameEnabled && (!vaultExists || dek === null);

  if (vaultNeedsPassword && !vaultPassword) {
    return "password_required";
  }

  if (!dek && vaultPassword && vaultExists) {
    dek = await unlockVault(vaultPassword, me.vaultSlots);
    await completeVaultUnlock(dek, me);
  }

  return { vaultExists, dek };
}

function validateProfileVaultContext(
  intent: ProfileSaveIntent,
  context: ProfileVaultContext,
  e2eeNameEnabled: boolean
): string | null {
  if (intent.nameChanged && e2eeNameEnabled && !context.dek) {
    return "Encryption vault is not available in this tab.";
  }
  if (!context.vaultExists && intent.nameChanged && e2eeNameEnabled) {
    return "Sign out and sign in again to finish encryption setup.";
  }
  return null;
}

async function buildProfilePatchPayload(
  intent: ProfileSaveIntent,
  dek: CryptoKey | null,
  e2eeNameEnabled: boolean
): Promise<PatchMePayload> {
  const payload: PatchMePayload = {};
  if (intent.nameChanged) {
    payload.displayName = await resolveStoredField(dek, intent.trimmedName, e2eeNameEnabled);
  }
  if (intent.usernameChanged) {
    payload.username = intent.trimmedUsername;
    payload.currentPassword = intent.confirmedPassword;
  }
  return payload;
}

type ProfileNetworkUpdateParams = {
  sessionToken: string;
  intent: ProfileSaveIntent;
  vaultPassword?: string;
  dekInSession: CryptoKey | null;
  completeVaultUnlock: (dek: CryptoKey, me?: MeResponse) => Promise<void>;
  completeLoginWithPassword: (tokens: TokenPair, password: string) => Promise<unknown>;
  updateDisplayName: (name: string | null) => void;
  onVaultPasswordRequired: () => void;
  onError: (messages: string[]) => void;
};

export async function runProfileNetworkUpdate({
  sessionToken,
  intent,
  vaultPassword,
  dekInSession,
  completeVaultUnlock,
  completeLoginWithPassword,
  updateDisplayName,
  onVaultPasswordRequired,
  onError,
}: ProfileNetworkUpdateParams): Promise<boolean> {
  const me = await fetchMe(sessionToken);
  const e2eeNameEnabled = isE2eeEnabled(
    parseClientSettings(me.clientSettings ?? null),
    "display_name"
  );

  const vaultContext = await resolveProfileVaultContext(
    sessionToken,
    intent,
    completeVaultUnlock,
    vaultPassword,
    dekInSession
  );
  if (vaultContext === "password_required") {
    onVaultPasswordRequired();
    return false;
  }

  const validationError = validateProfileVaultContext(intent, vaultContext, e2eeNameEnabled);
  if (validationError) {
    onError([validationError]);
    return false;
  }

  const payload = await buildProfilePatchPayload(intent, vaultContext.dek, e2eeNameEnabled);
  if (!payload.displayName && !payload.username) {
    return true;
  }

  const tokens = await patchMeWithToken(sessionToken, payload);
  if (tokens && intent.confirmedPassword) {
    await completeLoginWithPassword(tokens, intent.confirmedPassword);
  } else if (intent.nameChanged) {
    updateDisplayName(intent.trimmedName || null);
  }

  return true;
}

export async function runRecoveryEmailEnroll(
  intent: ProfileSaveIntent,
  security?: SecurityConfirmResult
): Promise<MeResponse> {
  return setRecoveryEmail({
    recoveryEmail: intent.trimmedRecovery,
    currentPassword: intent.confirmedPassword ?? "",
    totp: security?.totp,
    recoveryCode: security?.recoveryCode,
  });
}

export type ProfileSaveFlowResult =
  | { kind: "interrupted" }
  | { kind: "security_required" }
  | { kind: "mfa_required" }
  | { kind: "saved"; recoveryMe?: MeResponse };

type ProfileSaveFlowParams = {
  intent: ProfileSaveIntent;
  e2eeNameEnabled: boolean;
  vaultPassword?: string;
  security?: SecurityConfirmResult;
  dekInSession: CryptoKey | null;
  completeVaultUnlock: (dek: CryptoKey, me?: MeResponse) => Promise<void>;
  completeLoginWithPassword: (tokens: TokenPair, password: string) => Promise<unknown>;
  updateDisplayName: (name: string | null) => void;
  onVaultPasswordRequired: () => void;
  onError: (messages: string[]) => void;
};

export async function runProfileSaveFlow({
  intent,
  e2eeNameEnabled,
  vaultPassword,
  security,
  dekInSession,
  completeVaultUnlock,
  completeLoginWithPassword,
  updateDisplayName,
  onVaultPasswordRequired,
  onError,
}: ProfileSaveFlowParams): Promise<ProfileSaveFlowResult> {
  const mayNeedVaultPasswordFirst =
    intent.nameChanged && e2eeNameEnabled && !vaultPassword && dekInSession === null;

  if (intent.needsSecurity && !intent.confirmedPassword && !mayNeedVaultPasswordFirst) {
    return { kind: "security_required" };
  }

  if (intent.needsMfaInput && intent.confirmedPassword) {
    return { kind: "mfa_required" };
  }

  if (intent.needsProfileNetwork) {
    let profilePhaseComplete = false;
    await withSessionToken(async (sessionToken) => {
      profilePhaseComplete = await runProfileNetworkUpdate({
        sessionToken,
        intent,
        vaultPassword,
        dekInSession,
        completeVaultUnlock,
        completeLoginWithPassword,
        updateDisplayName,
        onVaultPasswordRequired,
        onError,
      });
    });
    if (!profilePhaseComplete) {
      return { kind: "interrupted" };
    }
  }

  if (intent.wantsRecovery && intent.confirmedPassword) {
    const recoveryMe = await runRecoveryEmailEnroll(intent, security);
    return { kind: "saved", recoveryMe };
  }

  return { kind: "saved" };
}

export function mapProfileSaveError(
  error: unknown,
  vaultPassword?: string
): { kind: "vault" | "security" | "conflict" | "generic"; message: string } {
  if (error instanceof ApiError && error.status === 401) {
    if (vaultPassword) {
      return { kind: "vault", message: "Password is incorrect." };
    }
    return { kind: "security", message: "Password or MFA verification failed." };
  }
  if (error instanceof ApiError && error.status === 409) {
    return { kind: "conflict", message: "Username is already taken." };
  }
  return {
    kind: "generic",
    message: errorMessage(error, "Could not save profile changes."),
  };
}

export type ProfileSaveFlowHandlers = {
  onSecurityRequired: (needsMfaForRecovery: boolean) => void;
  onMfaRequired: () => void;
  onSaved: (recoveryMe?: MeResponse) => Promise<void>;
};

export async function applyProfileSaveFlowResult(
  result: ProfileSaveFlowResult,
  intent: ProfileSaveIntent,
  handlers: ProfileSaveFlowHandlers
): Promise<void> {
  if (result.kind === "security_required") {
    handlers.onSecurityRequired(intent.needsMfaForRecovery);
    return;
  }
  if (result.kind === "mfa_required") {
    handlers.onMfaRequired();
    return;
  }
  if (result.kind === "interrupted") {
    return;
  }
  await handlers.onSaved(result.recoveryMe);
}

export type ProfileSaveErrorHandlers = {
  onVaultError: (message: string) => void;
  onSecurityError: (message: string, needsMfaForRecovery: boolean) => void;
  onFormError: (message: string) => void;
};

export function handleProfileSaveError(
  error: unknown,
  intent: ProfileSaveIntent,
  vaultPassword?: string,
  handlers?: ProfileSaveErrorHandlers
): void {
  if (!handlers) {
    return;
  }
  const mapped = mapProfileSaveError(error, vaultPassword);
  if (mapped.kind === "vault") {
    handlers.onVaultError(mapped.message);
    return;
  }
  if (mapped.kind === "security") {
    handlers.onSecurityError(mapped.message, intent.needsMfaForRecovery);
    return;
  }
  handlers.onFormError(mapped.message);
}

export type ProfileDetailsSaveContext = {
  user: AuthUser;
  name: string;
  username: string;
  recoveryEmail: string;
  e2eeNameEnabled: boolean;
  saveInFlightRef: { current: boolean };
  completeVaultUnlock: (dek: CryptoKey, me?: MeResponse) => Promise<void>;
  completeLoginWithPassword: (tokens: TokenPair, password: string) => Promise<unknown>;
  updateDisplayName: (name: string | null) => void;
  applyMe: (me: MeResponse) => Promise<void>;
  releaseSaveLock: () => void;
  setDetailsSaving: (saving: boolean) => void;
  setErrorMessages: (messages: string[]) => void;
  setSaved: (saved: boolean) => void;
  setVaultModalErrors: (messages: string[]) => void;
  setVaultModalOpen: (open: boolean) => void;
  openSecurityModal: (
    purpose: "save" | "recovery-remove",
    options: { passwordRequired: boolean; mfaEnabled: boolean }
  ) => void;
  setSecurityModalErrors: (messages: string[]) => void;
  setRecoveryEmailField: (value: string) => void;
};

export async function executeProfileDetailsSave(
  ctx: ProfileDetailsSaveContext,
  vaultPassword?: string,
  security?: SecurityConfirmResult
): Promise<void> {
  if (!ctx.user || ctx.saveInFlightRef.current) {
    return;
  }

  ctx.saveInFlightRef.current = true;
  ctx.setDetailsSaving(true);
  ctx.setErrorMessages([]);
  ctx.setSaved(false);

  const intent = resolveProfileSaveIntent(
    ctx.user,
    ctx.name,
    ctx.username,
    ctx.recoveryEmail,
    security,
    vaultPassword
  );

  try {
    const dekInSession = await readDEK();
    const result = await runProfileSaveFlow({
      intent,
      e2eeNameEnabled: ctx.e2eeNameEnabled,
      vaultPassword,
      security,
      dekInSession,
      completeVaultUnlock: ctx.completeVaultUnlock,
      completeLoginWithPassword: ctx.completeLoginWithPassword,
      updateDisplayName: ctx.updateDisplayName,
      onVaultPasswordRequired: () => {
        ctx.releaseSaveLock();
        ctx.setVaultModalErrors([]);
        ctx.setVaultModalOpen(true);
      },
      onError: ctx.setErrorMessages,
    });

    await applyProfileSaveFlowResult(result, intent, {
      onSecurityRequired: (needsMfaForRecovery) => {
        ctx.releaseSaveLock();
        ctx.openSecurityModal("save", {
          passwordRequired: true,
          mfaEnabled: needsMfaForRecovery,
        });
      },
      onMfaRequired: () => {
        ctx.releaseSaveLock();
        ctx.openSecurityModal("save", { passwordRequired: false, mfaEnabled: true });
      },
      onSaved: async (recoveryMe) => {
        if (recoveryMe) {
          ctx.setRecoveryEmailField("");
          await ctx.applyMe(recoveryMe);
        }
        ctx.setSaved(true);
      },
    });
  } catch (error) {
    handleProfileSaveError(error, intent, vaultPassword, {
      onVaultError: (message) => {
        ctx.releaseSaveLock();
        ctx.setVaultModalErrors([message]);
        ctx.setVaultModalOpen(true);
      },
      onSecurityError: (message, needsMfaForRecovery) => {
        ctx.releaseSaveLock();
        ctx.openSecurityModal("save", {
          passwordRequired: true,
          mfaEnabled: needsMfaForRecovery,
        });
        ctx.setSecurityModalErrors([message]);
      },
      onFormError: (message) => {
        ctx.setErrorMessages([message]);
      },
    });
  } finally {
    ctx.saveInFlightRef.current = false;
    ctx.setDetailsSaving(false);
  }
}

export async function confirmProfileRecoveryEmailClear(options: {
  result: SecurityConfirmResult;
  user: AuthUser | null;
  applyMe: (me: MeResponse) => Promise<void>;
  setDetailsSaving: (saving: boolean) => void;
  setSecurityModalMfaEnabled: (enabled: boolean) => void;
  setSecurityModalErrors: (messages: string[]) => void;
  setSecurityModalOpen: (open: boolean) => void;
  setSaved: (saved: boolean) => void;
}): Promise<void> {
  const {
    result,
    user,
    applyMe,
    setDetailsSaving,
    setSecurityModalMfaEnabled,
    setSecurityModalErrors,
    setSecurityModalOpen,
    setSaved,
  } = options;

  setDetailsSaving(true);
  setSecurityModalErrors([]);
  try {
    const me = await clearRecoveryEmail({
      currentPassword: result.password,
    });
    await applyMe(me);
    setSecurityModalOpen(false);
    setSaved(true);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      setSecurityModalMfaEnabled(user?.multifactorEnabled ?? false);
      setSecurityModalErrors(["Password or MFA verification failed."]);
    } else {
      setSecurityModalErrors([errorMessage(error, "Could not clear recovery email.")]);
    }
  } finally {
    setDetailsSaving(false);
  }
}
