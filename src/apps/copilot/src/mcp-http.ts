import type { CopilotConfig } from "@copilot/config";
import { dbPoolConfig } from "@ndb/database/config";
import { createReadonlySqlExecutor } from "@ndb/database/readonly";
import { createLogger } from "@ndb/logger";
import { createMcpHttpHandler } from "@ndb/mcp";
import { Pool } from "pg";

export async function runHttpMcpServer(config: CopilotConfig): Promise<void> {
  const logger = createLogger({
    app: "copilot",
    environment: config.environment,
    level: config.logLevel,
  });

  const pool = new Pool(dbPoolConfig(config.readonlyDb));
  try {
    await pool.query("SELECT 1");
    logger.info("mcp.db.readonly.ready");
  } catch {
    logger.warn("mcp.db.readonly.ping-failed");
  }

  const sql = createReadonlySqlExecutor(pool);
  const fetchHandler = createMcpHttpHandler({
    apiOrigin: config.apiOrigin,
    sql,
  });

  const server = Bun.serve({
    hostname: config.host,
    port: config.port,
    fetch: fetchHandler,
  });

  logger.info("mcp.server.http.starting", {
    url: `http://${config.host}:${server.port}/mcp`,
  });

  const shutdown = async () => {
    server.stop();
    await pool.end();
  };

  process.once("SIGINT", () => {
    void shutdown();
  });
  process.once("SIGTERM", () => {
    void shutdown();
  });
}
