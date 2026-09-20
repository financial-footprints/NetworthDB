import {
  AUTH_ACR_AAL1,
  AUTH_ACR_AAL2,
  AUTH_AMR_OTP,
  AUTH_AMR_PASSWORD,
  AUTH_AMR_RECOVERY,
  AUTH_AMR_WEBAUTHN,
} from "@core/domains/auth/constants";
import type { User } from "@core/domains/user/entities/user/index";
import { UnauthorizedError } from "@core/shared/errors/domain-error";

export {
  AUTH_ACR_AAL1,
  AUTH_ACR_AAL2,
  AUTH_AMR_OTP,
  AUTH_AMR_PASSWORD,
  AUTH_AMR_RECOVERY,
  AUTH_AMR_WEBAUTHN,
} from "@core/domains/auth/constants";

export type SessionTokenPair = {
  sessionToken: string;
  refreshToken: string;
  expiresIn: number;
};

export type MultifactorMethod = "totp" | "webauthn" | "recovery";

export type MultifactorChallengeResponse = {
  status: "multifactor_required" | "multifactor_enrollment_required";
  multifactorToken: string;
  expiresIn: number;
  methods: MultifactorMethod[];
};

export type LoginResult = SessionTokenPair | MultifactorChallengeResponse;

export type PublicMultifactorState = {
  multifactorMethods: string[];
  recoveryCodesEnabled: boolean;
};

export type ResolvedSession = {
  user: User;
  sessionId: string;
  authAmr: string;
  authAcr: string;
};

export type MultifactorProofInput = {
  password?: string;
  totp?: string;
  recoveryCode?: string;
  webauthnSessionId?: string;
  webauthnResponse?: Record<string, unknown>;
};

export interface PasswordLockout {
  isLocked(username: string): Promise<boolean>;
  recordFailure(username: string): Promise<void>;
  reset(username: string): Promise<void>;
}

export type AuthContext = {
  amr: string;
  acr: string;
};

export function isSessionTokenPair(result: LoginResult): result is SessionTokenPair {
  return "sessionToken" in result;
}

export function passwordOnlyAuth(): AuthContext {
  return {
    amr: AUTH_AMR_PASSWORD,
    acr: AUTH_ACR_AAL1,
  };
}

export function totpAuth(): AuthContext {
  return {
    amr: `${AUTH_AMR_PASSWORD},${AUTH_AMR_OTP}`,
    acr: AUTH_ACR_AAL2,
  };
}

export function recoveryCodeAuth(): AuthContext {
  return {
    amr: `${AUTH_AMR_PASSWORD},${AUTH_AMR_RECOVERY}`,
    acr: AUTH_ACR_AAL2,
  };
}

export function webauthnAuth(): AuthContext {
  return {
    amr: `${AUTH_AMR_PASSWORD},${AUTH_AMR_WEBAUTHN}`,
    acr: AUTH_ACR_AAL2,
  };
}

export function assertAal2(multifactorEnabled: boolean, authAcr: string): void {
  if (multifactorEnabled && authAcr !== AUTH_ACR_AAL2) {
    throw new UnauthorizedError("Additional authentication is required.");
  }
}
