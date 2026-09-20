import { createApp } from "@ndb/api";
import type { ApiConfig } from "@ndb/bootstrap";
import type { Role } from "@ndb/core";
import { type AuthTestServices, createAuthTestServices } from "@tests/api/helpers/auth-services";
import { fakeConfig } from "@tests/api/helpers/config";
import { createMemoryLogger, type MemoryLogger } from "@tests/api/helpers/memory-logger";
import type { createTestSecurityStores } from "@tests/auth/helpers";

export async function createTestApp(options?: {
  username?: string;
  password?: string;
  role?: Role;
  multifactorEnabled?: boolean;
  webauthnEnabled?: boolean;
  seedUser?: boolean;
  securityStores?: ReturnType<typeof createTestSecurityStores>;
}): Promise<{
  app: ReturnType<typeof createApp>;
  services: AuthTestServices;
  config: ApiConfig;
  logger: MemoryLogger;
}> {
  const config = fakeConfig();
  const logger = createMemoryLogger();
  const seedUser = options?.seedUser ?? true;

  const services = await createAuthTestServices(
    options?.username,
    options?.password,
    options?.role,
    options?.multifactorEnabled,
    options?.webauthnEnabled,
    options?.securityStores,
    { seedUser }
  );

  const app = createApp({ config, logger, services });

  return { app, services, config, logger };
}
