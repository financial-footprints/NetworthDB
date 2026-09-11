import type { ApiConfig } from "@bootstrap/config/api";
import { loadConfig } from "@bootstrap/config/api";
import { type ApiServices, createApiServices, createAuthServices } from "@bootstrap/services";
import { KvstoreAuthLimits } from "@ndb/auth";
import { createDbClient, parseDbEnv } from "@ndb/database";
import type { Logger } from "@ndb/logger";
import { createLogger } from "@ndb/logger";
import { createPool, initStatementsRuntime, type Pool, wrap } from "@ndb/statements";

export type ApiRuntime = {
  config: ApiConfig;
  logger: Logger;
  services: ApiServices;
  pool: Pool;
  close: () => Promise<void>;
};

export async function loadApiRuntime(): Promise<ApiRuntime> {
  const config = loadConfig();
  const logger = createLogger({
    level: config.app.logLevel,
    app: "api",
  });

  initStatementsRuntime();
  const pool = createPool({ threads: config.jobs.workers });
  const compute = wrap(pool);

  const dbHandle = createDbClient({ config: parseDbEnv() });
  const authLimits = await KvstoreAuthLimits.connect({
    kvstore: config.auth.security.kvstore,
    rate: config.auth.security.rate,
    lockout: {
      maxFailures: config.auth.multifactor.lockout.maxFailures,
      ttl: config.auth.multifactor.ttl.lockout,
    },
    logger,
  });
  const authServices = createAuthServices(dbHandle.client, {
    ttl: config.ttl,
    app: { environment: config.app.environment },
    auth: {
      limits: authLimits,
      multifactor: config.auth.multifactor,
      webauthn: config.auth.webauthn,
      recovery: config.auth.recovery,
    },
    logger,
  });
  const services = createApiServices(
    dbHandle.client,
    {
      app: { environment: config.app.environment },
      auth: authServices,
      jobs: config.jobs,
      encryption: config.encryption,
      advancedSecurity: config.advancedSecurity,
    },
    compute
  );
  services.jobRunner.onCancel((jobId) => {
    pool.cancel(jobId);
  });

  const recovered = await services.jobRunner.recoverJobs();
  if (recovered > 0) {
    logger.info("jobs.orphan.failed", { count: recovered });
  }

  let logsCleanupInterval: ReturnType<typeof setInterval> | undefined;
  if (config.app.environment === "production") {
    const purgeLogs = async () => {
      const count = await services.jobRunner.purgeExpiredLogs();
      if (count > 0) {
        logger.info("jobs.logs.purged", { count });
      }
    };
    void purgeLogs();
    logsCleanupInterval = setInterval(
      () => {
        void purgeLogs();
      },
      24 * 60 * 60 * 1000
    );
  }

  return {
    config,
    logger,
    services,
    pool,
    close: async () => {
      if (logsCleanupInterval) {
        clearInterval(logsCleanupInterval);
      }
      services.jobRunner.shutdown();
      await pool.shutdown();
      await authLimits.close();
      await dbHandle.close();
    },
  };
}
