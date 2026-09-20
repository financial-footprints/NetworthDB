import {
  API,
  apiPath,
  type mfaVerifyReqSchema,
  recoveryCodeSchema,
  sessionTokenSchema,
  totpBeginSchema,
  type totpConfirmReqSchema,
  type totpDisableReqSchema,
  webauthnCredSchema,
  webauthnSessionSchema,
} from "@ndb/platform";
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/browser";
import { startAuthentication } from "@simplewebauthn/browser";
import { apiRequest } from "@web/utils/api/client";
import type { TokenPair } from "@web/utils/api/routes/auth/types";
import type { ListData } from "@web/utils/api/types";
import type { z } from "zod";

type TotpBeginResponse = z.infer<typeof totpBeginSchema>["data"];

type WebAuthnBeginResponse = {
  sessionId: string;
  options: PublicKeyCredentialRequestOptionsJSON;
};

function webAuthnOptionsFromWire(
  options: Record<string, unknown>
): PublicKeyCredentialRequestOptionsJSON {
  if (typeof options.challenge !== "string") {
    throw new Error("Invalid WebAuthn request options.");
  }
  return options as unknown as PublicKeyCredentialRequestOptionsJSON;
}

function webAuthnCreationOptionsFromWire(
  options: Record<string, unknown>
): PublicKeyCredentialCreationOptionsJSON {
  if (typeof options.challenge !== "string") {
    throw new Error("Invalid WebAuthn creation options.");
  }
  return options as unknown as PublicKeyCredentialCreationOptionsJSON;
}

export type MfaProofPayload = {
  totp?: string;
  recoveryCode?: string;
  webauthnSessionId?: string;
  webauthnResponse?: AuthenticationResponseJSON;
};

export type MfaStepUpPayload = MfaProofPayload & {
  password?: string;
};

export type WebAuthnRegisterFinishPayload = {
  sessionId: string;
  response: RegistrationResponseJSON;
  name?: string;
  password?: string;
  totp?: string;
  recoveryCode?: string;
  webauthnSessionId?: string;
  webauthnResponse?: AuthenticationResponseJSON;
};

export type WebAuthnCredential = z.infer<typeof webauthnCredSchema>["items"][number];

type WebAuthnCredentialsResponse = ListData<WebAuthnCredential>;

type MfaVerifyPayload = z.infer<typeof mfaVerifyReqSchema>;

type WebAuthnLoginBeginResponse = WebAuthnBeginResponse;

type WebAuthnRegisterBeginResponse = {
  sessionId: string;
  options: PublicKeyCredentialCreationOptionsJSON;
};

export type WebAuthnLoginFinishPayload = {
  sessionId: string;
  response: AuthenticationResponseJSON;
};

type RecoveryCodesResponse = z.infer<typeof recoveryCodeSchema>["data"];

export type WebAuthnMfaProof = {
  webauthnSessionId: string;
  webauthnResponse: AuthenticationResponseJSON;
};

function mfaProofApiBody(
  payload?: MfaStepUpPayload
): z.infer<typeof mfaVerifyReqSchema> | Record<string, unknown> | undefined {
  if (!payload) {
    return undefined;
  }
  const body: Record<string, unknown> = {};
  if (payload.password?.trim()) {
    body.password = payload.password;
  }
  if (payload.totp?.trim()) {
    body.totp = payload.totp;
  }
  if (payload.recoveryCode?.trim()) {
    body.recoveryCode = payload.recoveryCode;
  }
  if (payload.webauthnSessionId && payload.webauthnResponse) {
    body.webauthnSessionId = payload.webauthnSessionId;
    body.webauthnResponse = payload.webauthnResponse;
  }
  return Object.keys(body).length > 0 ? body : undefined;
}

export async function mfaVerify(
  bearerToken: string,
  payload: MfaVerifyPayload
): Promise<TokenPair> {
  const response = await apiRequest(API.auth.session.multifactor.otp, {
    method: "POST",
    sessionToken: bearerToken,
    body: payload,
    schema: sessionTokenSchema,
  });
  return response.data;
}

export async function webauthnLoginBegin(bearerToken: string): Promise<WebAuthnLoginBeginResponse> {
  const response = await apiRequest(API.auth.session.multifactor.webauthn.begin, {
    method: "POST",
    sessionToken: bearerToken,
    schema: webauthnSessionSchema,
  });
  return {
    sessionId: response.data.sessionId,
    options: webAuthnOptionsFromWire(response.data.options),
  };
}

export async function webauthnLoginFinish(
  bearerToken: string,
  payload: WebAuthnLoginFinishPayload
): Promise<TokenPair> {
  const response = await apiRequest(API.auth.session.multifactor.webauthn.finish, {
    method: "POST",
    sessionToken: bearerToken,
    body: payload,
    schema: sessionTokenSchema,
  });
  return response.data;
}

export async function totpBegin(
  bearerToken: string,
  stepUp?: MfaStepUpPayload,
  signal?: AbortSignal
): Promise<TotpBeginResponse> {
  const response = await apiRequest(API.users.me.totp.begin, {
    method: "POST",
    sessionToken: bearerToken,
    body: mfaProofApiBody(stepUp),
    schema: totpBeginSchema,
    ...(signal ? { signal } : {}),
  });
  return response.data;
}

export async function totpConfirm(bearerToken: string, code: string): Promise<TokenPair> {
  const response = await apiRequest(API.users.me.totp.confirm, {
    method: "POST",
    sessionToken: bearerToken,
    body: { code } satisfies z.infer<typeof totpConfirmReqSchema>,
    schema: sessionTokenSchema,
  });
  return response.data;
}

export async function totpDisable(bearerToken: string, proof: MfaProofPayload): Promise<void> {
  const totp = proof.totp?.trim();
  if (!totp) {
    throw new Error("TOTP code is required.");
  }
  await apiRequest(API.users.me.totp.disable, {
    method: "DELETE",
    sessionToken: bearerToken,
    body: { totp } satisfies z.infer<typeof totpDisableReqSchema>,
  });
}

export async function webauthnRegisterBegin(
  bearerToken: string,
  payload?: MfaStepUpPayload
): Promise<WebAuthnRegisterBeginResponse> {
  const response = await apiRequest(API.users.me.webauthn.create.begin, {
    method: "POST",
    sessionToken: bearerToken,
    body: mfaProofApiBody(payload),
    schema: webauthnSessionSchema,
  });
  return {
    sessionId: response.data.sessionId,
    options: webAuthnCreationOptionsFromWire(response.data.options),
  };
}

export async function webauthnRegisterFinish(
  bearerToken: string,
  payload: WebAuthnRegisterFinishPayload
): Promise<TokenPair> {
  const response = await apiRequest(API.users.me.webauthn.create.finish, {
    method: "POST",
    sessionToken: bearerToken,
    body: payload,
    schema: sessionTokenSchema,
  });
  return response.data;
}

export async function deleteWebAuthnCredential(
  bearerToken: string,
  credentialId: string,
  proof: MfaProofPayload
): Promise<void> {
  await apiRequest(apiPath(API.users.me.webauthn.delete, { credentialId }), {
    method: "DELETE",
    sessionToken: bearerToken,
    body: mfaProofApiBody(proof),
  });
}

export async function listWebAuthnCredentials(
  bearerToken: string
): Promise<WebAuthnCredentialsResponse> {
  return apiRequest(API.users.me.webauthn.list, {
    sessionToken: bearerToken,
    schema: webauthnCredSchema,
  });
}

export async function recoveryGenerate(
  bearerToken: string,
  payload: MfaProofPayload
): Promise<RecoveryCodesResponse> {
  const response = await apiRequest(API.users.me.codes, {
    method: "POST",
    sessionToken: bearerToken,
    body: mfaProofApiBody(payload) ?? {},
    schema: recoveryCodeSchema,
  });
  return response.data;
}

export async function recoveryClear(bearerToken: string, proof: MfaProofPayload): Promise<void> {
  await apiRequest(API.users.me.codes, {
    method: "DELETE",
    sessionToken: bearerToken,
    body: mfaProofApiBody(proof),
  });
}

export async function collectWebAuthnMfaProof(bearerToken: string): Promise<WebAuthnMfaProof> {
  const begin = await webauthnLoginBegin(bearerToken);
  const assertion = await startAuthentication({
    optionsJSON: begin.options,
  });
  return {
    webauthnSessionId: begin.sessionId,
    webauthnResponse: assertion,
  };
}

export function parseOtpauthSecret(uri: string): string | null {
  try {
    const url = new URL(uri);
    if (url.protocol !== "otpauth:") {
      return null;
    }
    const secret = url.searchParams.get("secret");
    return secret?.trim() ? secret : null;
  } catch {
    return null;
  }
}
