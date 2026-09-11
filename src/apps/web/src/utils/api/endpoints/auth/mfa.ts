import { API } from "@ndb/platform";
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/browser";
import { startAuthentication } from "@simplewebauthn/browser";
import { del, get, post } from "@web/utils/api/client";
import type { TokenPair } from "@web/utils/api/endpoints/auth/types";
import { apiPath } from "@web/utils/api/path";
import type { ListData } from "@web/utils/api/types";

type TotpBeginResponse = {
  uri: string;
};

type WebAuthnBeginResponse = {
  session_id: string;
  options: { publicKey: PublicKeyCredentialCreationOptionsJSON };
};

export type MfaProofPayload = {
  totp?: string;
  recovery_code?: string;
  webauthn_session_id?: string;
  webauthn_response?: AuthenticationResponseJSON;
};

export type MfaStepUpPayload = MfaProofPayload & {
  password?: string;
};

export type WebAuthnRegisterFinishPayload = {
  session_id: string;
  response: RegistrationResponseJSON;
  name?: string;
  password?: string;
  totp?: string;
  recovery_code?: string;
  webauthn_session_id?: string;
  webauthn_response?: AuthenticationResponseJSON;
};

export type WebAuthnRegisterBeginPayload = MfaStepUpPayload;

export type WebAuthnCredential = {
  id: string;
  name: string;
  created_at: string;
};

type WebAuthnCredentialsResponse = ListData<WebAuthnCredential>;

type MfaVerifyPayload = {
  totp?: string;
  recovery_code?: string;
};

type WebAuthnLoginBeginResponse = {
  session_id: string;
  options: { publicKey: PublicKeyCredentialRequestOptionsJSON };
};

export type WebAuthnLoginFinishPayload = {
  session_id: string;
  response: AuthenticationResponseJSON;
};

type RecoveryCodesResponse = {
  recovery_codes: string[];
};

export type WebAuthnMfaProof = {
  webauthn_session_id: string;
  webauthn_response: AuthenticationResponseJSON;
};

function isTokenPair(value: unknown): value is TokenPair {
  return (
    typeof value === "object" &&
    value !== null &&
    "session_token" in value &&
    typeof (value as TokenPair).session_token === "string" &&
    "refresh_token" in value &&
    typeof (value as TokenPair).refresh_token === "string"
  );
}

function stepUpBody(payload?: MfaStepUpPayload): MfaStepUpPayload | undefined {
  if (!payload) {
    return undefined;
  }
  const body: MfaStepUpPayload = {};
  if (payload.password?.trim()) {
    body.password = payload.password;
  }
  if (payload.totp?.trim()) {
    body.totp = payload.totp;
  }
  if (payload.recovery_code?.trim()) {
    body.recovery_code = payload.recovery_code;
  }
  if (payload.webauthn_session_id && payload.webauthn_response) {
    body.webauthn_session_id = payload.webauthn_session_id;
    body.webauthn_response = payload.webauthn_response;
  }
  return Object.keys(body).length > 0 ? body : undefined;
}

function mfaProofBody(proof?: MfaProofPayload): MfaProofPayload | undefined {
  return stepUpBody(proof);
}

export async function mfaVerify(
  bearerToken: string,
  payload: MfaVerifyPayload
): Promise<TokenPair> {
  const { data } = await post<TokenPair>(API.auth.session.multifactor.otp, payload, {
    sessionToken: bearerToken,
  });
  return data;
}

export async function webauthnLoginBegin(bearerToken: string): Promise<WebAuthnLoginBeginResponse> {
  const { data } = await post<WebAuthnLoginBeginResponse>(
    API.auth.session.multifactor.webauthn.begin,
    undefined,
    { sessionToken: bearerToken }
  );
  return data;
}

export async function webauthnLoginFinish(
  bearerToken: string,
  payload: WebAuthnLoginFinishPayload
): Promise<TokenPair> {
  const { data } = await post<TokenPair>(API.auth.session.multifactor.webauthn.finish, payload, {
    sessionToken: bearerToken,
  });
  return data;
}

export async function totpBegin(
  bearerToken: string,
  stepUp?: MfaStepUpPayload,
  signal?: AbortSignal
): Promise<TotpBeginResponse> {
  const { data } = await post<TotpBeginResponse>(API.users.me.totp.begin, stepUpBody(stepUp), {
    sessionToken: bearerToken,
    ...(signal ? { signal } : {}),
  });
  return data;
}

export async function totpConfirm(bearerToken: string, code: string): Promise<TokenPair | null> {
  const { data } = await post<TokenPair | null>(
    API.users.me.totp.confirm,
    { code },
    { sessionToken: bearerToken }
  );
  return isTokenPair(data) ? data : null;
}

export async function totpDisable(bearerToken: string, proof: MfaProofPayload): Promise<void> {
  await del(API.users.me.totp.disable, {
    body: proof,
    sessionToken: bearerToken,
  });
}

export async function webauthnRegisterBegin(
  bearerToken: string,
  payload?: WebAuthnRegisterBeginPayload
): Promise<WebAuthnBeginResponse> {
  const { data } = await post<WebAuthnBeginResponse>(
    API.users.me.webauthn.create.begin,
    stepUpBody(payload),
    { sessionToken: bearerToken }
  );
  return data;
}

export async function webauthnRegisterFinish(
  bearerToken: string,
  payload: WebAuthnRegisterFinishPayload
): Promise<TokenPair | null> {
  const { data } = await post<TokenPair | null>(API.users.me.webauthn.create.finish, payload, {
    sessionToken: bearerToken,
  });
  return isTokenPair(data) ? data : null;
}

export async function deleteWebAuthnCredential(
  bearerToken: string,
  credentialId: string,
  proof: MfaProofPayload
): Promise<void> {
  await del(apiPath(API.users.me.webauthn.details, { id: credentialId }), {
    body: proof,
    sessionToken: bearerToken,
  });
}

export async function listWebAuthnCredentials(
  bearerToken: string
): Promise<WebAuthnCredentialsResponse> {
  const { data } = await get<WebAuthnCredentialsResponse>(API.users.me.webauthn.list, {
    sessionToken: bearerToken,
  });
  return data;
}

export async function recoveryGenerate(
  bearerToken: string,
  payload: MfaProofPayload
): Promise<RecoveryCodesResponse> {
  const { data } = await post<RecoveryCodesResponse>(
    API.users.me.codes,
    mfaProofBody(payload) ?? {},
    { sessionToken: bearerToken }
  );
  return data;
}

export async function recoveryClear(bearerToken: string, proof: MfaProofPayload): Promise<void> {
  await del(API.users.me.codes, {
    body: proof,
    sessionToken: bearerToken,
  });
}

export async function collectWebAuthnMfaProof(bearerToken: string): Promise<WebAuthnMfaProof> {
  const begin = await webauthnLoginBegin(bearerToken);
  const assertion = await startAuthentication({
    optionsJSON: begin.options.publicKey,
  });
  return {
    webauthn_session_id: begin.session_id,
    webauthn_response: assertion,
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
