import type { CopilotConfig } from "@copilot/config";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { dbPoolConfig } from "@ndb/database/config";
import { createReadonlySqlExecutor } from "@ndb/database/readonly";
import { createLogger } from "@ndb/logger";
import { assembleMcpCatalog, createMcpServer, SessionStore } from "@ndb/mcp";
import { Pool } from "pg";

export async function runStdioMcpServer(config: CopilotConfig): Promise<void> {
  const logger = createLogger({
    app: "copilot",
    environment: config.environment,
    level: config.logLevel,
    logFd: "stderr",
  });

  const pool = new Pool(dbPoolConfig(config.readonlyDb));
  try {
    await pool.query("SELECT 1");
    logger.info("mcp.db.readonly.ready");
  } catch {
    logger.warn("mcp.db.readonly.ping-failed");
  }

  const shutdown = async () => {
    await pool.end();
  };

  process.once("SIGINT", () => {
    void shutdown();
  });
  process.once("SIGTERM", () => {
    void shutdown();
  });

  const session = new SessionStore({ apiOrigin: config.apiOrigin });

  if (config.startupLogin) {
    const { username, password, totp } = config.startupLogin;
    try {
      const outcome = await session.login({ username, password, totp });
      if (outcome.kind === "authenticated") {
        logger.info("mcp.auth.startup-login.success", {
          username: session.getState().user?.username,
        });
      } else {
        logger.warn("mcp.auth.startup-mfa-required", { kind: outcome.kind });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn("mcp.auth.startup-login.failed", { message });
    }
  }

  logger.info("mcp.server.stdio.starting");

  const sql = createReadonlySqlExecutor(pool);
  const catalog = assembleMcpCatalog({ session, sql });
  await serveStdio(() => createMcpServer(catalog));
}
