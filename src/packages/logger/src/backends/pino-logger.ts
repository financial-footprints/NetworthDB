import { type LogFd, writeLogLine } from "@logger/capture";
import { getRequestLogContext } from "@logger/request-context";
import type { LogContext, Logger, LogLevel } from "@ndb/core";
import { redactObject } from "@ndb/platform";
import pino from "pino";

const LEVEL_TO_PINO: Record<LogLevel, pino.Level> = {
  debug: "debug",
  info: "info",
  warn: "warn",
  error: "error",
};

export class PinoLogger implements Logger {
  private readonly minLevel: LogLevel;

  constructor(
    private readonly logger: pino.Logger,
    minLevel: LogLevel = "info"
  ) {
    this.minLevel = minLevel;
  }

  static create(
    defaultContext: LogContext = {},
    minLevel: LogLevel = "info",
    logFd: LogFd = "stdout",
    onLine?: (line: string) => void
  ): PinoLogger {
    const logger = pino(
      {
        level: LEVEL_TO_PINO[minLevel],
        messageKey: "msg",
        base: defaultContext,
      },
      {
        write(message: string) {
          const line = message.trimEnd();
          writeLogLine(line, logFd);
          onLine?.(line);
        },
      }
    );
    return new PinoLogger(logger, minLevel);
  }

  debug(msg: string, context?: LogContext): void {
    this.logger.debug(this.mergeContext(context), msg);
  }

  info(msg: string, context?: LogContext): void {
    this.logger.info(this.mergeContext(context), msg);
  }

  warn(msg: string, context?: LogContext): void {
    this.logger.warn(this.mergeContext(context), msg);
  }

  error(msg: string, context?: LogContext): void {
    this.logger.error(this.mergeContext(context), msg);
  }

  child(context: LogContext): Logger {
    return new PinoLogger(this.logger.child(context), this.minLevel);
  }

  private mergeContext(context?: LogContext): LogContext {
    return {
      ...getRequestLogContext(),
      ...(context ? redactObject(context) : {}),
    };
  }
}
