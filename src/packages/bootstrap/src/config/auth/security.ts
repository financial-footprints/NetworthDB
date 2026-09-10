import type { BootstrapEnv } from "@bootstrap/config/env";

export type SecurityConfig = {
  authRateLimit: number;
  authRateWindowMs: number;
  kvstoreUrl: string;
};

export function loadSecurityConfig(env: BootstrapEnv): SecurityConfig {
  return {
    authRateLimit: env.AUTH_RATE_LIMIT,
    authRateWindowMs: env.AUTH_RATE_WINDOW,
    kvstoreUrl: env.KVSTORE_URL,
  };
}
