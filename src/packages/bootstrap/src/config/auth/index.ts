import { loadMultifactorConfig, type MultifactorConfig } from "@bootstrap/config/auth/multifactor";
import { loadRecoveryConfig, type RecoveryConfig } from "@bootstrap/config/auth/recovery";
import { loadSecurityConfig, type SecurityConfig } from "@bootstrap/config/auth/security";
import { loadWebAuthnConfig, type WebAuthnConfig } from "@bootstrap/config/auth/webauthn";
import type { BootstrapEnv } from "@bootstrap/config/env";
import type { AppEnv } from "@ndb/core";

export type { MultifactorConfig } from "@bootstrap/config/auth/multifactor";
export type { RecoveryConfig } from "@bootstrap/config/auth/recovery";
export type { SecurityConfig } from "@bootstrap/config/auth/security";
export type { WebAuthnConfig } from "@bootstrap/config/auth/webauthn";

type AuthConfig = {
  multifactor: MultifactorConfig;
  webauthn: WebAuthnConfig;
  recovery: RecoveryConfig;
  security: SecurityConfig;
};

export function loadAuthConfig(env: BootstrapEnv, environment: AppEnv): AuthConfig {
  const multifactor = loadMultifactorConfig(env, environment);

  return {
    multifactor,
    webauthn: loadWebAuthnConfig(env, environment, multifactor.ttl.challenge),
    recovery: loadRecoveryConfig(env, environment),
    security: loadSecurityConfig(env),
  };
}
