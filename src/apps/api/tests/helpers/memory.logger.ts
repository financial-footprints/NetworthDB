import type { Logger, LogLevel } from "@ndb/logger";

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

  const logger: MemoryLogger = {
    entries,
    debug(message, context) {
      entries.push({ level: "debug", message, context: { ...defaultContext, ...context } });
    },
    info(message, context) {
      entries.push({ level: "info", message, context: { ...defaultContext, ...context } });
    },
    warn(message, context) {
      entries.push({ level: "warn", message, context: { ...defaultContext, ...context } });
    },
    error(message, context) {
      entries.push({ level: "error", message, context: { ...defaultContext, ...context } });
    },
    child(context) {
      return createMemoryLogger({ ...defaultContext, ...context });
    },
  };

  return logger;
}
