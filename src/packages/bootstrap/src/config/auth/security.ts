import type { BootstrapEnv } from "@bootstrap/config/env";

export type SecurityConfig = {
  rate: {
    limit: number;
    windowMs: number;
  };
  kvstore: {
    url: string;
  };
};

export function loadSecurityConfig(env: BootstrapEnv): SecurityConfig {
  return {
    rate: {
      limit: env.AUTH_RATE_LIMIT,
      windowMs: env.AUTH_RATE_WINDOW,
    },
    kvstore: {
      url: env.KVSTORE_URL,
    },
  };
}
