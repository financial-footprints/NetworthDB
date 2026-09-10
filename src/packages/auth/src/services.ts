import type { KvstoreAuthLimits } from "@auth/ratelimit";
import {
  AuthService,
  type AuthServiceConfig,
  type MultifactorServiceConfig,
  VaultService,
  type WebAuthnServiceConfig,
} from "@ndb/core";
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
import type { Logger } from "@ndb/logger";
import { createEmailSender, type EmailDeliveryConfig } from "@ndb/notifications";

export type CreateAuthServiceConfig = {
  sessionTtl: number;
  refreshTtl: number;
  environment: AuthServiceConfig["appEnv"];
  multifactor: Omit<MultifactorServiceConfig, "appEnv">;
  webauthn: Omit<WebAuthnServiceConfig, "appEnv" | "mfaRequiredRoles">;
  recovery: {
    recoveryAppBaseUrl: string | null;
    passwordTokenTtlMs: number;
    advancedTokenTtlMs: number;
    email: EmailDeliveryConfig;
  };
  logger: Logger;
  authLimits: KvstoreAuthLimits;
};

export type CreateAuthResult = {
  auth: AuthService;
  vault: VaultService;
};

export function createAuthService(db: DbClient, config: CreateAuthServiceConfig): CreateAuthResult {
  const users = new DrizzleUserRepository(db);
  const sessions = new DrizzleSessionRepository(db);
  const multifactorChallenges = new DrizzleMultifactorChallengeRepository(db);
  const recoveryCodes = new DrizzleRecoveryCodeRepository(db);
  const recoveryChallenges = new DrizzleRecoveryChallengeRepository(db);
  const webauthnCredentials = new DrizzleWebAuthnCredsRepository(db);
  const webauthnSessions = new DrizzleWebAuthnSessionRepository(db);
  const vaultSlots = new DrizzleVaultSlotRepository(db);
  const vault = new VaultService(users, vaultSlots, webauthnCredentials);
  const emailSender = createEmailSender({
    environment: config.environment,
    email: config.recovery.email,
    logger: config.logger,
  });

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
    passwordLockout: config.authLimits.passwordLockout,
    rateLimiter: config.authLimits.rateLimiter,
    config: {
      sessionTtl: config.sessionTtl,
      refreshTtl: config.refreshTtl,
      appEnv: config.environment,
      multifactor: {
        ...config.multifactor,
        appEnv: config.environment,
      },
      webauthn: {
        ...config.webauthn,
        mfaRequiredRoles: config.multifactor.mfaRequiredRoles,
        appEnv: config.environment,
      },
      recovery: {
        appEnv: config.environment,
        recoveryAppBaseUrl: config.recovery.recoveryAppBaseUrl,
        passwordTokenTtlMs: config.recovery.passwordTokenTtlMs,
        advancedTokenTtlMs: config.recovery.advancedTokenTtlMs,
      },
    },
  });

  return { auth, vault };
}
