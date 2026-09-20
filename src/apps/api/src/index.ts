import type { AppDependencies } from "@api/config/bootstrap";
import type { AuthEnv, BaseEnv } from "@api/config/hono-env";
import {
  accountRoutes,
  authRoutes,
  backupRoutes,
  categoryRoutes,
  configRoutes,
  creditCardRoutes,
  dashboardRoutes,
  enrollmentRoutes,
  healthRoutes,
  jobRoutes,
  ruleGroupRoutes,
  ruleRoutes,
  sessionRoutes,
  sourcesRoutes,
  tagRoutes,
  userRoutes,
} from "@api/routes";
import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import {
  corsMiddleware,
  errorHandler,
  logMiddleware,
  requireSession,
  security,
} from "@ndb/middleware";
import { NOT_FOUND_RESPONSE, PUBLIC_API_PATHS, REQUEST_ID_HEADER } from "@ndb/platform";

export function createApp(deps: AppDependencies): OpenAPIHono<BaseEnv> {
  const app = new OpenAPIHono<BaseEnv>();
  const publicPaths = new Set<string>(PUBLIC_API_PATHS);

  app.use("*", logMiddleware(deps.logger));
  app.use(
    "*",
    corsMiddleware({
      allowedOrigins: deps.config.cors.allowedOrigins,
      allowLocalhost: deps.config.app.environment !== "production",
    })
  );
  app.use("*", async (c, next) => {
    c.set("config", deps.config);
    c.set("services", deps.services);
    await next();
  });
  app.use("*", async (c, next) => {
    if (publicPaths.has(c.req.path)) {
      return next();
    }
    return requireSession<AuthEnv>()(c as never, next);
  });
  app.use("*", security({ backupMaxUploadBytes: deps.config.backupMaxUploadBytes }));
  app.onError(errorHandler(deps.logger));

  app.notFound((c) => {
    const rayId = c.header(REQUEST_ID_HEADER) ?? c.req.header(REQUEST_ID_HEADER);
    return c.json(rayId ? { ...NOT_FOUND_RESPONSE, rayId } : NOT_FOUND_RESPONSE, 404);
  });

  app.doc("/doc", {
    openapi: "3.0.0",
    info: {
      title: "NetworthDB API",
      version: "0.0.0",
    },
  });
  app.get("/doc/ui", swaggerUI({ url: "/doc" }));

  app.route("/", healthRoutes);
  app.route("/", configRoutes);
  app.route("/", creditCardRoutes);
  app.route("/", accountRoutes);
  app.route("/", categoryRoutes);
  app.route("/", tagRoutes);
  app.route("/", ruleGroupRoutes);
  app.route("/", ruleRoutes);
  app.route("/", sourcesRoutes);
  app.route("/", jobRoutes);
  app.route("/", backupRoutes);
  app.route("/", dashboardRoutes);
  app.route("/", authRoutes);
  app.route("/", sessionRoutes);
  app.route("/", userRoutes);
  app.route("/", enrollmentRoutes);

  return app;
}
