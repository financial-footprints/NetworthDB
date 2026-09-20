import type { AppEnv, LogContext, Logger, LogLevel } from "@ndb/core";

export type { LogContext, Logger, LogLevel };

export type CreateLoggerOptions = {
  level: LogLevel;
  app: string;
  environment: AppEnv;
  defaultContext?: LogContext;
  /** MCP stdio uses stdout for JSON-RPC; copilot should use stderr. */
  logFd?: "stdout" | "stderr";
  onLine?: (line: string) => void;
};
