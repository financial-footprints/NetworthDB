import type { ApiConfig } from "@bootstrap/config/api";
import { loadConfig } from "@bootstrap/config/api";
import { type ApiServices, createApiServices, createAuthServices } from "@bootstrap/services";
import { KvstoreAuthLimits } from "@ndb/auth";
import type { Logger } from "@ndb/core";
import { createDbClient } from "@ndb/database";
import { parseDbEnv } from "@ndb/database/env";
import { createLogger } from "@ndb/logger";
import { createPool, wrap } from "@ndb/statements";

export type ApiRuntime = {
  config: ApiConfig;
  logger: Logger;
  services: ApiServices;
  close: () => Promise<void>;
};

export async function loadApiRuntime(): Promise<ApiRuntime> {
  const config = loadConfig();
  const logger = createLogger({
    level: config.app.logLevel,
    app: "api",
    environment: config.app.environment,
  });

  const statementsRuntime = {
    filestorePath: config.filestore.path,
    encryptAtRest: config.encryption.enabled,
    logLevel: config.app.logLevel,
    environment: config.app.environment,
  };
  const pool = createPool({
    threads: config.jobs.workers,
    runtime: statementsRuntime,
  });

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
  const engine = wrap(pool, statementsRuntime);
  const services = createApiServices(
    dbHandle.client,
    {
      app: { environment: config.app.environment },
      auth: authServices,
      jobs: config.jobs,
      encryption: config.encryption,
      advancedSecurity: config.advancedSecurity,
      filestore: config.filestore,
    },
    engine
  );
  services.jobRunnerService.onCancel((jobId) => {
    pool.cancel(jobId);
  });

  const recovered = await services.jobRunnerService.recoverJobs();
  if (recovered > 0) {
    logger.info("jobs.orphan.failed", { count: recovered });
  }

  let maintenanceInterval: ReturnType<typeof setInterval> | undefined;
  const runMaintenance = async () => {
    const expiredExports = await services.backupService.purgeExpiredExports();
    if (expiredExports > 0) {
      logger.info("backup.exports.purged", { count: expiredExports });
    }
    const logs = await services.jobRunnerService.purgeExpiredLogs();
    if (logs > 0) {
      logger.info("jobs.logs.purged", { count: logs });
    }
  };
  void runMaintenance();
  maintenanceInterval = setInterval(
    () => {
      void runMaintenance();
    },
    60 * 60 * 1000
  );

  return {
    config,
    logger,
    services,
    close: async () => {
      if (maintenanceInterval) {
        clearInterval(maintenanceInterval);
      }
      services.jobRunnerService.shutdown();
      await pool.shutdown();
      await authLimits.close();
      await dbHandle.close();
    },
  };
}
