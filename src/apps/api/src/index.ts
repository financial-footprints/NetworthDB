import type { AppDependencies } from "@api/config/bootstrap";
import { loadApiRuntime } from "@api/config/bootstrap";
import { createHealthRoutes } from "@api/routes/health";
import { corsMiddleware, errorHandler, logMiddleware, securityMiddleware } from "@ndb/middleware";
import { Hono } from "hono";

export function createApp(deps: AppDependencies): Hono {
  const app = new Hono();

  app.use("*", logMiddleware({ logger: deps.logger }));
  app.use(
    "*",
    corsMiddleware({
      allowedOrigins: deps.config.corsAllowOrigins,
      allowLocalhost: deps.config.environment !== "production",
    })
  );
  app.use("*", securityMiddleware());
  app.onError(errorHandler(deps.logger));
  app.route("/", createHealthRoutes(deps.services));

  return app;
}

if (import.meta.main) {
  try {
    const runtime = await loadApiRuntime();
    const app = createApp({
      config: runtime.config,
      logger: runtime.logger,
      services: runtime.services,
    });
    const { host, port } = runtime.config;

    Bun.serve({
      hostname: host,
      port,
      fetch: app.fetch,
    });

    runtime.logger.info("api.server.listening", { host, port });
  } catch {
    process.exit(1);
  }
}
