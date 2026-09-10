import type { ApiConfig, ApiServices, AppEnv, Logger } from "@ndb/bootstrap";
import { loadApiRuntime } from "@ndb/bootstrap";

export type { ApiConfig, ApiServices, AppEnv, Logger };
export { loadApiRuntime };

export interface AppDependencies {
  config: ApiConfig;
  logger: Logger;
  services: ApiServices;
}
