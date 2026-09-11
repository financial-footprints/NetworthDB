import type { LoginResult, TokenPair } from "@web/utils/api/endpoints/auth/types";

type LoginResponsePayload = {
  session_token?: string;
  refresh_token?: string;
  expires_in?: number;
  status?: string;
  multifactor_token?: string;
  methods?: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseTokenPair(payload: LoginResponsePayload): TokenPair | null {
  if (
    typeof payload.session_token !== "string" ||
    typeof payload.refresh_token !== "string" ||
    typeof payload.expires_in !== "number"
  ) {
    return null;
  }

  return {
    session_token: payload.session_token,
    refresh_token: payload.refresh_token,
    expires_in: payload.expires_in,
  };
}

function parseMultifactorChallenge(
  payload: LoginResponsePayload,
  kind: "multifactor_required" | "multifactor_enrollment_required"
): LoginResult | null {
  if (typeof payload.multifactor_token !== "string" || typeof payload.expires_in !== "number") {
    return null;
  }

  const methods = Array.isArray(payload.methods)
    ? payload.methods.filter((method): method is string => typeof method === "string")
    : [];

  return {
    kind,
    multifactorToken: payload.multifactor_token,
    expiresIn: payload.expires_in,
    methods,
  };
}

export function parseLoginResponse(payload: unknown): LoginResult {
  if (!isRecord(payload)) {
    throw new Error("Unexpected login response from auth service.");
  }

  const data = payload as LoginResponsePayload;

  if (data.status === "multifactor_required") {
    const challenge = parseMultifactorChallenge(data, "multifactor_required");
    if (challenge) {
      return challenge;
    }
  }

  if (data.status === "multifactor_enrollment_required") {
    const challenge = parseMultifactorChallenge(data, "multifactor_enrollment_required");
    if (challenge) {
      return challenge;
    }
  }

  const tokens = parseTokenPair(data);
  if (tokens) {
    return { kind: "authenticated", tokens };
  }

  throw new Error("Unexpected login response from auth service.");
}
