import type { SessionStore, SessionUser } from "@mcp/auth/session-store";

export class McpAuthError extends Error {
  constructor(message = "mcp.auth.unauthenticated") {
    super(message);
    this.name = "McpAuthError";
  }
}

export function requireSession(store: SessionStore): SessionUser {
  const state = store.getState();
  if (!state.authenticated || !state.user) {
    throw new McpAuthError();
  }
  return state.user;
}
