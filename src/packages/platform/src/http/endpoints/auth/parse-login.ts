import { loginSchema } from "@platform/http/endpoints/auth/session";
import type { SessionTokenApi } from "@platform/http/endpoints/types";
import type { z } from "zod";

export type TokenPair = SessionTokenApi;

export type LoginResult =
  | { kind: "authenticated"; tokens: TokenPair }
  | {
      kind: "multifactor_required";
      multifactorToken: string;
      expiresIn: number;
      methods: string[];
    }
  | {
      kind: "multifactor_enrollment_required";
      multifactorToken: string;
      expiresIn: number;
      methods: string[];
    };

const UNEXPECTED_LOGIN = "Unexpected login response from auth service.";

function parseLoginEnvelope(payload: unknown): z.infer<typeof loginSchema> {
  const direct = loginSchema.safeParse(payload);
  if (direct.success) {
    return direct.data;
  }

  const unwrapped = loginSchema.safeParse({ data: payload });
  if (unwrapped.success) {
    return unwrapped.data;
  }

  throw new Error(UNEXPECTED_LOGIN);
}

export function parseLoginResponse(payload: unknown): LoginResult {
  const envelope = parseLoginEnvelope(payload);
  const data = envelope.data;

  if ("sessionToken" in data) {
    return {
      kind: "authenticated",
      tokens: {
        sessionToken: data.sessionToken,
        refreshToken: data.refreshToken,
        expiresIn: data.expiresIn,
      },
    };
  }

  if (data.status === "multifactor_required") {
    return {
      kind: "multifactor_required",
      multifactorToken: data.multifactorToken,
      expiresIn: data.expiresIn,
      methods: data.methods,
    };
  }

  if (data.status === "multifactor_enrollment_required") {
    return {
      kind: "multifactor_enrollment_required",
      multifactorToken: data.multifactorToken,
      expiresIn: data.expiresIn,
      methods: data.methods,
    };
  }

  throw new Error(UNEXPECTED_LOGIN);
}
