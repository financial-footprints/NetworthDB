import type { AppDependencies } from "@api/config/bootstrap";
import type { MultifactorContext, SessionContext } from "@ndb/middleware";

export type BaseEnv = {
  Variables: {
    config: AppDependencies["config"];
    services: AppDependencies["services"];
  };
};

export type AuthEnv = {
  Variables: BaseEnv["Variables"] & SessionContext & MultifactorContext;
};
