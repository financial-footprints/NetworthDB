import type { AuthService } from "@ndb/core";
import { type AppEnv, UserService, type VaultService } from "@ndb/core";
import type { DbClient } from "@ndb/database";
import { DrizzleUserRepository, pingDb } from "@ndb/database";

export type HealthStatus = {
  ok: boolean;
};

export class HealthService {
  constructor(private readonly db: DbClient) {}

  async check(): Promise<HealthStatus> {
    return { ok: await pingDb(this.db) };
  }
}

export type ApiServices = {
  health: HealthService;
  user: UserService;
  vault: VaultService;
  auth: AuthService;
};

type CreateApiServicesConfig = {
  environment: AppEnv;
  auth: AuthService;
  vault: VaultService;
};

export function createApiServices(db: DbClient, config: CreateApiServicesConfig): ApiServices {
  const userRepository = new DrizzleUserRepository(db);
  const user = new UserService(userRepository, config.auth, config.environment);

  return {
    health: new HealthService(db),
    user,
    vault: config.vault,
    auth: config.auth,
  };
}
