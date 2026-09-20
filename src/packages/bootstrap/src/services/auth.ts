import type { MultifactorConfig, RecoveryConfig, WebAuthnConfig } from "@bootstrap/config/api";
import { createAuthCrypto, type KvstoreAuthLimits } from "@ndb/auth";
import type { Logger } from "@ndb/core";
import { type AppEnv, AuthService, type AuthServiceConfig, VaultService } from "@ndb/core";
import type { DbClient } from "@ndb/database";
import {
  DrizzleMultifactorChallengeRepository,
  DrizzleRecoveryChallengeRepository,
  DrizzleRecoveryCodeRepository,
  DrizzleSessionRepository,
  DrizzleUserRepository,
  DrizzleVaultSlotRepository,
  DrizzleWebAuthnCredsRepository,
  DrizzleWebAuthnSessionRepository,
} from "@ndb/database";
import { createEmailSender } from "@ndb/notifications";

export type CreateAuthServicesConfig = {
  ttl: {
    session: number;
    refresh: number;
  };
  app: {
    environment: AppEnv;
  };
  auth: {
    limits: KvstoreAuthLimits;
    multifactor: MultifactorConfig;
    webauthn: WebAuthnConfig;
    recovery: RecoveryConfig;
  };
  logger: Logger;
};

export type AuthServices = {
  auth: AuthService;
  vault: VaultService;
};

export function createAuthServices(db: DbClient, config: CreateAuthServicesConfig): AuthServices {
  const environment = config.app.environment;
  const crypto = createAuthCrypto({
    mfaEncryptionKey: config.auth.multifactor.encryptionKey,
    webauthn: config.auth.webauthn.rp,
  });

  const users = new DrizzleUserRepository(db);
  const sessions = new DrizzleSessionRepository(db);
  const multifactorChallenges = new DrizzleMultifactorChallengeRepository(db);
  const recoveryCodes = new DrizzleRecoveryCodeRepository(db);
  const recoveryChallenges = new DrizzleRecoveryChallengeRepository(db);
  const webauthnCredentials = new DrizzleWebAuthnCredsRepository(db);
  const webauthnSessions = new DrizzleWebAuthnSessionRepository(db);
  const vaultSlots = new DrizzleVaultSlotRepository(db);

  const vault = new VaultService(users, vaultSlots, webauthnCredentials, crypto.password);
  const emailSender = createEmailSender({
    email: config.auth.recovery.email,
    logger: config.logger,
  });

  const authConfig: AuthServiceConfig = {
    ttl: config.ttl,
    appEnv: environment,
    multifactor: {
      mfaTotpSkew: config.auth.multifactor.totpSkew,
      mfaMaxFailures: config.auth.multifactor.lockout.maxFailures,
      mfaRequiredRoles: config.auth.multifactor.requiredRoles,
      ttl: {
        challenge: config.auth.multifactor.ttl.challenge,
        lockout: config.auth.multifactor.ttl.lockout,
      },
      appEnv: environment,
    },
    webauthn: {
      ttl: config.auth.webauthn.ttl,
      mfaRequiredRoles: config.auth.multifactor.requiredRoles,
      appEnv: environment,
    },
    recovery: {
      appEnv: environment,
      recoveryAppBaseUrl: config.auth.recovery.recoveryAppBaseUrl,
      ttl: config.auth.recovery.ttl,
    },
  };

  const auth = new AuthService({
    users,
    sessions,
    multifactorChallenges,
    recoveryCodes,
    recoveryChallenges,
    webauthnCredentials,
    webauthnSessions,
    vault,
    emailSender,
    passwordLockout: config.auth.limits.passwordLockout,
    rateLimiter: config.auth.limits.rateLimiter,
    crypto,
    config: authConfig,
  });

  return { auth, vault };
}
