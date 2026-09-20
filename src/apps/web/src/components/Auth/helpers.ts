import { ApiError } from "@web/utils/api/types";
import { errorMessage } from "@web/utils/errors";
import { useCallback, useState } from "react";

export const AUTHENTICATOR_METHOD_LABEL = "Authenticator";
export const AUTHENTICATOR_CODE_LABEL = "Authenticator Code";

export const PASSKEY_VERIFY_INSTRUCTION = "Sign in with passkey to continue.";
export const PASSKEY_VERIFY_DESCRIPTION =
  "Use your device's biometrics, Face ID, fingerprint, PIN, or security key to verify it's you.";

export const TOTP_CODE_INVALID_MESSAGE = "Enter the 6-digit code from your authenticator.";
export const TOTP_CODE_UNAUTHORIZED_MESSAGE =
  "Invalid code. Check your authenticator and try again.";
export const PREVIOUS_AUTHENTICATOR_CODE =
  "This code is from your current authenticator. Use the code shown for the new QR code above.";

const TOTP_CODE_PATTERN = /^\d{6}$/;

export type MfaVerifyMethod = "totp" | "webauthn" | "recovery";
export type MfaEnrollMethod = "totp" | "webauthn";
export type MfaProofMethod = "totp" | "recovery" | "webauthn";

export type MfaVerifyFlowPhase = { kind: "pick" } | { kind: "method"; method: MfaVerifyMethod };

export type MfaEnrollFlowPhase = { kind: "pick" } | { kind: "method"; method: MfaEnrollMethod };

export function isTotpCode(value: string): boolean {
  return TOTP_CODE_PATTERN.test(value.trim());
}

export function totpEnrollErrorMessage(
  error: unknown,
  fallback = "Could not complete authenticator setup. Please try again."
): string {
  if (error instanceof ApiError && error.status === 401) {
    const detail = error.message.trim().toLowerCase();
    if (detail === "code from previous authenticator") {
      return PREVIOUS_AUTHENTICATOR_CODE;
    }
    return TOTP_CODE_UNAUTHORIZED_MESSAGE;
  }
  return errorMessage(error, fallback);
}

export function normalizeRecoveryCode(value: string): string {
  return value.trim().replace(/\s+/g, "");
}

export function passkeyVerifyErrorMessage(error: ApiError): string {
  const detail = error.message.trim().toLowerCase();
  if (detail === "unauthorized") {
    return "Your MFA session expired. Go back and sign in again.";
  }
  if (detail === "invalid credentials") {
    return "Passkey verification failed. Check you selected the correct passkey and try again.";
  }
  if (error.message.trim()) {
    return error.message;
  }
  return "Passkey verification failed. Please try again.";
}

export function mfaProofRequiredMessage(hasWebAuthn: boolean): string {
  return hasWebAuthn
    ? "Enter an authenticator code, recovery code, or verify with a passkey."
    : "Enter an authenticator code or recovery code.";
}

export function mapStepUpAuthError(
  error: unknown,
  usingPassword: boolean,
  fallback = "Could not verify your identity. Please try again."
): string {
  if (error instanceof ApiError && error.status === 401) {
    return usingPassword
      ? "Password verification failed. Please try again."
      : "MFA verification failed. Please try again.";
  }
  if (error instanceof ApiError && error.status === 400 && usingPassword) {
    return errorMessage(error, "Current password is required.");
  }
  return errorMessage(error, fallback);
}

export function mapCreateUserError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return errorMessage(error, "Could not create user");
  }
  if (error.status === 409) {
    return "Username is already taken";
  }
  if (error.status === 403) {
    return "You do not have permission to create users";
  }
  if (error.status === 401 && error.message.toLowerCase().includes("mfa step-up")) {
    return "MFA step-up required. Sign out and sign back in with MFA, then try again.";
  }
  if (error.status === 400) {
    return error.message || "Invalid username or password";
  }
  return errorMessage(error, "Could not create user");
}

type MfaRemoveTarget = "totp" | "passkey" | "recovery";

export function mapMfaRemoveError(error: unknown, target: MfaRemoveTarget): string {
  if (error instanceof ApiError && error.status === 400) {
    const fallback =
      target === "totp"
        ? "Cannot remove your only MFA method. Add a passkey first, or contact an administrator."
        : target === "recovery"
          ? "Recovery codes are not enrolled."
          : "Cannot remove your only MFA method. Add an authenticator or another passkey first, or contact an administrator.";
    return errorMessage(error, fallback);
  }
  if (error instanceof ApiError && error.status === 401) {
    return "MFA verification failed. Please try again.";
  }
  if (error instanceof ApiError && error.status === 404 && target === "recovery") {
    return "This server does not support removing recovery codes.";
  }
  return errorMessage(error, "Could not remove MFA method. Please try again.");
}

export function mapDeleteUserError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 403) {
      return "You do not have permission to delete users";
    }
    if (error.status === 404) {
      return "User not found";
    }
    if (error.status === 400) {
      return error.message || "Cannot delete this user";
    }
  }
  throw error;
}

export function passkeyNotAllowedMessage(
  action: "registration" | "sign-in" | "verification"
): string {
  if (action === "registration") {
    return "Passkey registration was cancelled or is not allowed in this browser.";
  }
  if (action === "sign-in") {
    return "Passkey sign-in was cancelled or is not allowed in this browser.";
  }
  return "Passkey verification was cancelled or is not allowed in this browser.";
}

export function formatMfaMethodLabel(method: string): string {
  if (method === "totp") {
    return AUTHENTICATOR_METHOD_LABEL;
  }
  if (method === "webauthn") {
    return "Passkey";
  }
  if (method === "recovery") {
    return "Recovery Codes";
  }
  return method;
}

const MFA_VERIFY_METHOD_ORDER: MfaVerifyMethod[] = ["webauthn", "totp", "recovery"];

const MFA_ENROLL_METHOD_ORDER: MfaEnrollMethod[] = ["webauthn", "totp"];

export function filterSupportedMfaMethods<T extends string>(
  methods: string[],
  allowed: readonly T[],
  fallback?: readonly T[]
): T[] {
  const supported = allowed.filter((method) => methods.includes(method));
  if (supported.length === 0 && fallback) {
    return [...fallback];
  }
  return supported;
}

export function sortMfaVerifyMethods(methods: MfaVerifyMethod[]): MfaVerifyMethod[] {
  return MFA_VERIFY_METHOD_ORDER.filter((method) => methods.includes(method));
}

export function sortMfaEnrollMethods(methods: MfaEnrollMethod[]): MfaEnrollMethod[] {
  return MFA_ENROLL_METHOD_ORDER.filter((method) => methods.includes(method));
}

export function mfaEnrollSubtitle(phase: MfaEnrollFlowPhase): string {
  if (phase.kind === "pick") {
    return "Choose how you want to verify your identity when signing in.";
  }

  if (phase.method === "webauthn") {
    return "Name this passkey, then register using your device biometrics, PIN, or security key.";
  }

  return "Scan the QR code with your authenticator app, or enter the secret key manually.";
}

export function mfaVerifySubtitle(options: MfaVerifyMethod[], phase: MfaVerifyFlowPhase): string {
  if (options.length > 1 && phase.kind === "pick") {
    return "";
  }

  const activeMethod =
    phase.kind === "method" ? phase.method : options.length === 1 ? options[0] : null;

  if (activeMethod === "webauthn") {
    return "";
  }
  if (activeMethod === "totp") {
    return "Enter the code from your authenticator app.";
  }
  if (activeMethod === "recovery") {
    return "Enter one of your recovery codes.";
  }
  return "Continue by providing your authentication code or recovery code.";
}

export function useMfaVerifyErrors(onErrorMessagesChange?: (messages: string[]) => void) {
  const [localErrorMessages, setLocalErrorMessages] = useState<string[]>([]);
  const lifted = onErrorMessagesChange !== undefined;

  const setErrors = useCallback(
    (messages: string[]) => {
      if (lifted) {
        onErrorMessagesChange(messages);
        return;
      }
      setLocalErrorMessages(messages);
    },
    [lifted, onErrorMessagesChange]
  );

  return {
    setErrors,
    showInlineErrors: !lifted,
    localErrorMessages,
  };
}
