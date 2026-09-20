import type { Logger, LogLevel } from "@ndb/core";
import { getRequestLogContext } from "@ndb/logger";

type LogContext = Record<string, unknown>;

export type LogEntry = {
  level: LogLevel;
  message: string;
  context?: LogContext;
};

export type MemoryLogger = Logger & {
  entries: LogEntry[];
};

export function createMemoryLogger(defaultContext: LogContext = {}): MemoryLogger {
  const entries: LogEntry[] = [];

  const mergeContext = (context?: LogContext): LogContext => ({
    ...defaultContext,
    ...getRequestLogContext(),
    ...context,
  });

  const logger: MemoryLogger = {
    entries,
    debug(message, context) {
      entries.push({ level: "debug", message, context: mergeContext(context) });
    },
    info(message, context) {
      entries.push({ level: "info", message, context: mergeContext(context) });
    },
    warn(message, context) {
      entries.push({ level: "warn", message, context: mergeContext(context) });
    },
    error(message, context) {
      entries.push({ level: "error", message, context: mergeContext(context) });
    },
    child(context) {
      return createMemoryLogger({ ...defaultContext, ...context });
    },
  };

  return logger;
}
