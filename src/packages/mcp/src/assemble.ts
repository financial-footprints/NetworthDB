import type { SessionStore } from "@mcp/auth/session-store";
import { createMcpPrompts } from "@mcp/prompts";
import { createMcpResources } from "@mcp/resources";
import { assembleMcpTools } from "@mcp/tools/query";
import type { ReadonlySqlExecutor } from "@ndb/database/readonly";

export function assembleMcpCatalog(options: { session: SessionStore; sql?: ReadonlySqlExecutor }) {
  return {
    tools: assembleMcpTools(options),
    resources: createMcpResources(options),
    prompts: createMcpPrompts({ session: options.session }),
  };
}
