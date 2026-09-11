import type { SecurityConfirmResult } from "@web/context/Settings/modals/security/SecurityConfirmModal";
import {
  setRecoveryEmail as enrollRecoveryEmail,
  getMe,
  patchMeWithToken,
  withSessionToken,
} from "@web/utils/api/endpoints/auth";
import type {
  AuthUser,
  MeResponse,
  PatchMePayload,
  TokenPair,
} from "@web/utils/api/endpoints/auth/types";
import { ApiError } from "@web/utils/api/types";
import { hasE2EEVault, sealField, unlockVault } from "@web/utils/crypto/vault";
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
  const needsMfaForRecovery = wantsRecovery && user.multifactor_enabled;
  const needsMfaInput = needsMfaForRecovery && !security?.totp && !security?.recovery_code;

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
  const me = await getMe(sessionToken);
  const vaultExists = hasE2EEVault(me.vault_initialized);
  let dek = dekInSession ?? null;
  const vaultNeedsPassword = intent.nameChanged && (!vaultExists || dek === null);

  if (vaultNeedsPassword && !vaultPassword) {
    return "password_required";
  }

  if (!dek && vaultPassword && vaultExists) {
    dek = await unlockVault(vaultPassword, me.vault_slots);
    await completeVaultUnlock(dek, me);
  }

  return { vaultExists, dek };
}

function validateProfileVaultContext(
  intent: ProfileSaveIntent,
  context: ProfileVaultContext
): string | null {
  if (intent.nameChanged && !context.dek) {
    return "Encryption vault is not available in this tab.";
  }
  if (!context.vaultExists && intent.nameChanged) {
    return "Sign out and sign in again to finish encryption setup.";
  }
  return null;
}

async function buildProfilePatchPayload(
  intent: ProfileSaveIntent,
  dek: CryptoKey | null
): Promise<PatchMePayload> {
  const payload: PatchMePayload = {};
  if (intent.nameChanged && dek) {
    payload.display_name = await sealField(dek, intent.trimmedName);
  }
  if (intent.usernameChanged) {
    payload.username = intent.trimmedUsername;
    payload.current_password = intent.confirmedPassword;
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

  const validationError = validateProfileVaultContext(intent, vaultContext);
  if (validationError) {
    onError([validationError]);
    return false;
  }

  const payload = await buildProfilePatchPayload(intent, vaultContext.dek);
  if (!payload.display_name && !payload.username) {
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
  return enrollRecoveryEmail({
    recovery_email: intent.trimmedRecovery,
    current_password: intent.confirmedPassword ?? "",
    totp: security?.totp,
    recovery_code: security?.recovery_code,
  });
}

export type ProfileSaveFlowResult =
  | { kind: "interrupted" }
  | { kind: "security_required" }
  | { kind: "mfa_required" }
  | { kind: "saved"; recoveryMe?: MeResponse };

type ProfileSaveFlowParams = {
  intent: ProfileSaveIntent;
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
  vaultPassword,
  security,
  dekInSession,
  completeVaultUnlock,
  completeLoginWithPassword,
  updateDisplayName,
  onVaultPasswordRequired,
  onError,
}: ProfileSaveFlowParams): Promise<ProfileSaveFlowResult> {
  const mayNeedVaultPasswordFirst = intent.nameChanged && !vaultPassword && dekInSession === null;

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
        sessionToken: sessionToken,
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
