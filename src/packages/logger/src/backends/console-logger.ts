import { type LogFd, writeLogLine } from "@logger/capture";
import { getRequestLogContext } from "@logger/request-context";
import type { LogContext, Logger, LogLevel } from "@ndb/core";
import { redactObject } from "@ndb/platform";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class ConsoleLogger implements Logger {
  private readonly defaultContext: LogContext;
  private readonly minLevel: LogLevel;
  private readonly onLine?: (line: string) => void;
  private readonly logFd: LogFd;

  constructor(
    defaultContext: LogContext = {},
    minLevel: LogLevel = "info",
    logFd: LogFd = "stdout",
    onLine?: (line: string) => void
  ) {
    this.defaultContext = defaultContext;
    this.minLevel = minLevel;
    this.logFd = logFd;
    this.onLine = onLine;
  }

  debug(msg: string, context?: LogContext): void {
    this.log("debug", msg, context);
  }

  info(msg: string, context?: LogContext): void {
    this.log("info", msg, context);
  }

  warn(msg: string, context?: LogContext): void {
    this.log("warn", msg, context);
  }

  error(msg: string, context?: LogContext): void {
    this.log("error", msg, context);
  }

  child(context: LogContext): Logger {
    return new ConsoleLogger(
      { ...this.defaultContext, ...context },
      this.minLevel,
      this.logFd,
      this.onLine
    );
  }

  private log(level: LogLevel, msg: string, context?: LogContext): void {
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.minLevel]) {
      return;
    }
    if (msg.trim().length === 0) {
      throw new Error("logger.message.invalid.empty");
    }

    const entry: Record<string, unknown> = {
      time: new Date().toISOString(),
      level,
      msg,
      ...this.defaultContext,
      ...getRequestLogContext(),
    };

    if (context) {
      Object.assign(entry, redactObject(context));
    }

    const line = JSON.stringify(entry);
    writeLogLine(line, this.logFd);
    this.onLine?.(line);
  }
}
