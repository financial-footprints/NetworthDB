import { McpApiError } from "@mcp/api/errors";
import { McpAuthError } from "@mcp/auth/gate";

const READ_ONLY_MESSAGE =
  "Permission denied: this database connection is read-only. Do not retry write operations.";

const DB_QUERY_HINT =
  " Check src/apps/copilot/.env POSTGRES_* settings, ensure Postgres is running, and run bun run --filter @ndb/database migrate.";

function isReadOnlyDbError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const pgError = error as Error & { code?: string };
  if (pgError.code === "42501" || pgError.code === "25006") {
    return true;
  }

  return /read-only|read only transaction|permission denied/i.test(error.message);
}

function isDatabaseQueryError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return /failed query:|relation .* does not exist|ECONNREFUSED|password authentication failed/i.test(
    error.message
  );
}

export function formatMcpError(
  error: unknown,
  environment: string | undefined = process.env.ENVIRONMENT
): string {
  if (isReadOnlyDbError(error)) {
    return READ_ONLY_MESSAGE;
  }

  if (error instanceof McpAuthError || error instanceof McpApiError) {
    return `Error: ${error.message}`;
  }

  const message = error instanceof Error ? error.message : String(error);
  if (isDatabaseQueryError(error)) {
    const hint = environment === "local" ? DB_QUERY_HINT : "";
    return `Error: ${message}${hint}`;
  }

  return `Error: ${message}`;
}
