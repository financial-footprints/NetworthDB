import { loadCopilotConfig } from "@copilot/config";
import { runHttpMcpServer } from "@copilot/mcp-http";
import { runStdioMcpServer } from "@copilot/mcp-stdio";

const config = loadCopilotConfig();
if (config.transport === "http") {
  await runHttpMcpServer(config);
} else {
  await runStdioMcpServer(config);
}
