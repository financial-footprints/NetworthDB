import type { ApiConfig } from "@bootstrap/config/api";
import { loadConfig } from "@bootstrap/config/api";
import { type ApiServices, createApiServices } from "@bootstrap/services";
import { createAuthService, KvstoreAuthLimits } from "@ndb/auth";
import { createDbClient, parseDbEnv } from "@ndb/database";
import type { Logger } from "@ndb/logger";
import { createLogger } from "@ndb/logger";

export type ApiRuntime = {
  config: ApiConfig;
  logger: Logger;
  services: ApiServices;
  close: () => Promise<void>;
};

export async function loadApiRuntime(): Promise<ApiRuntime> {
  const config = loadConfig();
  const logger = createLogger({
    level: config.logLevel,
    app: "api",
  });

  const dbHandle = createDbClient({ config: parseDbEnv() });
  const authLimits = await KvstoreAuthLimits.connect({
    kvstoreUrl: config.security.kvstoreUrl,
    requestLimit: config.security.authRateLimit,
    requestWindowMs: config.security.authRateWindowMs,
    maxPasswordFailures: config.multifactor.mfaMaxFailures,
    passwordLockoutDurationMs: config.multifactor.mfaLockoutTtl,
    logger,
  });
  const created = createAuthService(dbHandle.client, {
    sessionTtl: config.sessionTtl,
    refreshTtl: config.refreshTtl,
    environment: config.environment,
    multifactor: config.multifactor,
    webauthn: config.webauthn,
    recovery: config.recovery,
    authLimits,
    logger,
  });
  const services = createApiServices(dbHandle.client, {
    environment: config.environment,
    auth: created.auth,
    vault: created.vault,
  });

  return {
    config,
    logger,
    services,
    close: async () => {
      await authLimits.close();
      await dbHandle.close();
    },
  };
}
