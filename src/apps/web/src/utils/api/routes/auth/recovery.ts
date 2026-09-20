import type { AdvancedRecoveryContextApi } from "@ndb/platform";
import { API, advCtxSchema, messageSchema } from "@ndb/platform";
import { apiRequest } from "@web/utils/api/client";

export async function beginPasswordReset(username: string, email: string): Promise<void> {
  await apiRequest(API.auth.recovery.password.begin, {
    method: "POST",
    body: { username, email },
    schema: messageSchema,
  });
}

export async function completePasswordReset(body: {
  token: string;
  newPassword: string;
  totp?: string;
  recoveryCode?: string;
  webauthnSessionId?: string;
  webauthnResponse?: Record<string, unknown>;
}): Promise<void> {
  await apiRequest(API.auth.recovery.password.complete, {
    method: "POST",
    body: {
      token: body.token,
      newPassword: body.newPassword,
      totp: body.totp,
      recoveryCode: body.recoveryCode,
      webauthnSessionId: body.webauthnSessionId,
      webauthnResponse: body.webauthnResponse,
    },
  });
}

export async function beginAdvancedRecovery(username: string, email: string): Promise<void> {
  await apiRequest(API.auth.recovery.advanced.begin, {
    method: "POST",
    body: { username, email },
    schema: messageSchema,
  });
}

export async function readAdvancedRecoveryContext(
  token: string
): Promise<AdvancedRecoveryContextApi> {
  const response = await apiRequest(API.auth.recovery.advanced.context, {
    method: "POST",
    body: { token },
    schema: advCtxSchema,
  });
  return response.data;
}

export async function completeAdvancedRecovery(body: {
  token: string;
  newPassword: string;
  passwordSlot?: { salt: string; wrapBlob: string };
  webauthnSessionId?: string;
  webauthnResponse?: Record<string, unknown>;
}): Promise<void> {
  await apiRequest(API.auth.recovery.advanced.complete, {
    method: "POST",
    body: {
      token: body.token,
      newPassword: body.newPassword,
      passwordSlot: body.passwordSlot
        ? { salt: body.passwordSlot.salt, wrapBlob: body.passwordSlot.wrapBlob }
        : undefined,
      webauthnSessionId: body.webauthnSessionId,
      webauthnResponse: body.webauthnResponse,
    },
  });
}

export function readRecoveryTokenFromHash(): string | null {
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) {
    return null;
  }
  const params = new URLSearchParams(hash);
  const token = params.get("token");
  return token && token.length > 0 ? token : null;
}
