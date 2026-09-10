import type { ApiConfig } from "@bootstrap/config/api";
import { loadConfig } from "@bootstrap/config/api";
import { type ApiServices, createApiServices } from "@bootstrap/services";
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
  const services = createApiServices(dbHandle.client);

  return {
    config,
    logger,
    services,
    close: async () => {
      await dbHandle.close();
    },
  };
}
