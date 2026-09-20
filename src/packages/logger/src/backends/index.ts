import { ConsoleLogger } from "@logger/backends/console-logger";
import { PinoLogger } from "@logger/backends/pino-logger";
import type { CreateLoggerOptions, Logger } from "@logger/types";

export function createLogger(options: CreateLoggerOptions): Logger {
  const defaultContext = {
    app: options.app,
    service: "networthdb",
    ...options.defaultContext,
  };

  const logFd = options.logFd ?? "stdout";

  if (options.environment === "local") {
    return new ConsoleLogger(defaultContext, options.level, logFd, options.onLine);
  }

  return PinoLogger.create(defaultContext, options.level, logFd, options.onLine);
}
