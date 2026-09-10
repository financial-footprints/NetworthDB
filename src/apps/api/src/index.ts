import type { AppDependencies } from "@api/config/bootstrap";
import { loadApiRuntime } from "@api/config/bootstrap";
import type { BaseEnv } from "@api/config/hono-env";
import authRoutes from "@api/routes/auth/index";
import sessionRoutes from "@api/routes/auth/sessions";
import healthRoutes from "@api/routes/health/index";
import enrollmentRoutes from "@api/routes/users/enrollment";
import userRoutes from "@api/routes/users/index";
import { OpenAPIHono } from "@hono/zod-openapi";
import { cors, onError, requestLog, security } from "@ndb/middleware";

export function createApp(deps: AppDependencies): OpenAPIHono<BaseEnv> {
  const app = new OpenAPIHono<BaseEnv>();

  app.use("*", requestLog(deps.logger));
  app.use(
    "*",
    cors({
      allowedOrigins: deps.config.corsAllowOrigins,
      allowLocalhost: deps.config.environment !== "production",
    })
  );
  app.use("*", security());
  app.use("*", async (c, next) => {
    c.set("config", deps.config);
    c.set("services", deps.services);
    await next();
  });
  app.onError(onError(deps.logger));

  app.route("/", healthRoutes);
  app.route("/", authRoutes);
  app.route("/", sessionRoutes);
  app.route("/", userRoutes);
  app.route("/", enrollmentRoutes);

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
