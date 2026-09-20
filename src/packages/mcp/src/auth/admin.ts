import { requireSession } from "@mcp/auth/gate";
import type { SessionStore, SessionUser } from "@mcp/auth/session-store";

export function requireElevated(session: SessionStore): SessionUser {
  const user = requireSession(session);
  if (user.role === "user") {
    throw new Error("mcp.admin.forbidden");
  }
  return user;
}
