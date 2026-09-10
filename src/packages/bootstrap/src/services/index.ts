import type { DbClient } from "@ndb/database";
import { pingDb } from "@ndb/database";

export type HealthStatus = {
  ok: boolean;
};

export type ApiServices = {
  health: () => Promise<HealthStatus>;
};

export function createApiServices(db: DbClient): ApiServices {
  return {
    async health() {
      const ok = await pingDb(db);
      return { ok };
    },
  };
}
