import type { SessionStore } from "@mcp/auth/session-store";
import type { McpToolDefinition } from "@mcp/helpers";
import { bindMethod } from "@mcp/tools/helpers";
import { emptyArgsSchema } from "@mcp/tools/schema";
import { SERVICE_CATALOG_BY_NAME } from "@mcp/tools/schema/inventory";
import { z } from "zod";

const authLoginSchema = z.object({
  username: z.string().optional(),
  password: z.string().optional(),
  totp: z.string().optional(),
  recoveryCode: z.string().optional(),
  multifactorToken: z.string().optional(),
});

function catalogEntry(name: string) {
  const entry = SERVICE_CATALOG_BY_NAME.get(name);
  if (!entry) {
    throw new Error(`mcp.tools.auth.missing-catalog.${name}`);
  }
  return entry;
}

export function createAuthTools(session: SessionStore): McpToolDefinition[] {
  return [
    bindMethod({
      catalog: catalogEntry("ping"),
      schema: emptyArgsSchema,
      invoke: async () => ({ ok: true }),
    }),
    bindMethod({
      catalog: catalogEntry("auth_login"),
      schema: authLoginSchema,
      invoke: async (input) => {
        const outcome = await session.login(input);
        if (outcome.kind === "authenticated") {
          return { kind: "authenticated" };
        }
        return outcome;
      },
    }),
    bindMethod({
      catalog: catalogEntry("auth_status"),
      schema: emptyArgsSchema,
      invoke: async () => session.getState(),
    }),
  ];
}
