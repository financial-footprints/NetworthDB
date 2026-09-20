import { loadApiRuntime } from "@api/config/bootstrap";
import { createApp } from "@api/index";

try {
  const runtime = await loadApiRuntime();
  const app = createApp({
    config: runtime.config,
    logger: runtime.logger,
    services: runtime.services,
  });
  const { host, port } = runtime.config.app;

  Bun.serve({
    hostname: host,
    port,
    fetch: app.fetch,
  });

  runtime.logger.info("api.server.listening", { host, port });
} catch (error) {
  console.error("api.server.start.failed", error);
  process.exit(1);
}
