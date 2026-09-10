import { type BootstrapEnv, getEnv } from "@bootstrap/config/env";
import type { AppEnv, Role } from "@ndb/core";
import { parseRole } from "@ndb/core";
import { z } from "zod";

const MULTIFACTOR_KEY_LENGTH = 32;
const MFA_TOTP_SKEW_MAX = 10;

const mfaEncryptionKeySchema = z.string().transform((value) => {
  const key = Buffer.from(value, "base64url");
  if (key.length !== MULTIFACTOR_KEY_LENGTH) {
    throw new Error(`bootstrap.config.env.invalid-multifactor-encryption-key.length.${key.length}`);
  }

  return key;
});

function parseMfaTotpSkew(skew: number): number {
  if (skew > MFA_TOTP_SKEW_MAX) {
    throw new Error(`bootstrap.config.env.invalid-non-negative-int.max.MFA_TOTP_SKEW.${skew}`);
  }

  return skew;
}

export type MultifactorConfig = {
  mfaEncryptionKey: Buffer | null;
  mfaChallengeTtl: number;
  mfaTotpSkew: number;
  mfaMaxFailures: number;
  mfaLockoutTtl: number;
  mfaRequiredRoles: Role[];
};

export function loadMultifactorConfig(env: BootstrapEnv, environment: AppEnv): MultifactorConfig {
  return {
    mfaEncryptionKey: getEnv(
      env,
      "MFA_ENCRYPTION_KEY",
      mfaEncryptionKeySchema,
      "required-in-production",
      environment === "production"
    ),
    mfaChallengeTtl: env.MFA_CHALLENGE_TTL,
    mfaTotpSkew: parseMfaTotpSkew(env.MFA_TOTP_SKEW),
    mfaMaxFailures: env.MFA_MAX_FAILURES,
    mfaLockoutTtl: env.MFA_LOCKOUT_TTL,
    mfaRequiredRoles: env.MFA_REQUIRED_ROLES.map(parseRole),
  };
}
