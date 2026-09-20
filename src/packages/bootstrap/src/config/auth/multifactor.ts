import { type BootstrapEnv, getEnv } from "@bootstrap/config/env";
import type { AppEnv, Role } from "@ndb/core";
import { decodeSecretKey } from "@ndb/encryption";
import { z } from "zod";

const MFA_TOTP_SKEW_MAX = 10;

const mfaSecretSchema = z.string().transform((value) => decodeSecretKey(value));

function parseMfaTotpSkew(skew: number): number {
  if (skew > MFA_TOTP_SKEW_MAX) {
    throw new Error(`bootstrap.config.env.invalid-non-negative-int.max.MFA_TOTP_SKEW.${skew}`);
  }

  return skew;
}

export type MultifactorConfig = {
  encryptionKey: Buffer;
  totpSkew: number;
  ttl: {
    challenge: number;
    lockout: number;
  };
  lockout: {
    maxFailures: number;
  };
  requiredRoles: Role[];
};

export function loadMultifactorConfig(env: BootstrapEnv, _environment: AppEnv): MultifactorConfig {
  return {
    encryptionKey: getEnv(env, "MFA_SECRET", mfaSecretSchema, "required"),
    totpSkew: parseMfaTotpSkew(env.MFA_TOTP_SKEW),
    ttl: {
      challenge: env.MFA_CHALLENGE_TTL,
      lockout: env.MFA_LOCKOUT_TTL,
    },
    lockout: {
      maxFailures: env.MFA_MAX_FAILURES,
    },
    requiredRoles: env.MFA_REQUIRED_ROLES,
  };
}
