import { describe, expect, test } from "bun:test";
import { createLogger } from "@ndb/logger";

describe("@ndb/logger", () => {
  test("writes JSON with app and service", () => {
    const lines: string[] = [];
    const original = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => {
      lines.push(String(chunk).trimEnd());
      return true;
    }) as typeof process.stdout.write;

    try {
      const logger = createLogger({ level: "debug", app: "test", environment: "local" });
      logger.info("logger.test.ok", { count: 1 });
      const parsed = JSON.parse(lines.at(-1) ?? "{}") as Record<string, unknown>;
      expect(parsed.msg).toBe("logger.test.ok");
      expect(parsed.app).toBe("test");
      expect(parsed.service).toBe("networthdb");
      expect(parsed.count).toBe(1);
    } finally {
      process.stdout.write = original;
    }
  });

  test("logFd stderr writes only to stderr", () => {
    const stdoutLines: string[] = [];
    const stderrLines: string[] = [];
    const originalStdout = process.stdout.write.bind(process.stdout);
    const originalStderr = process.stderr.write.bind(process.stderr);
    process.stdout.write = ((chunk: string | Uint8Array) => {
      stdoutLines.push(String(chunk).trimEnd());
      return true;
    }) as typeof process.stdout.write;
    process.stderr.write = ((chunk: string | Uint8Array) => {
      stderrLines.push(String(chunk).trimEnd());
      return true;
    }) as typeof process.stderr.write;

    try {
      const logger = createLogger({
        level: "debug",
        app: "test",
        environment: "local",
        logFd: "stderr",
      });
      logger.info("logger.stderr.test");
      expect(stdoutLines).toHaveLength(0);
      expect(stderrLines).toHaveLength(1);
      expect(stderrLines[0]).toContain("logger.stderr.test");
    } finally {
      process.stdout.write = originalStdout;
      process.stderr.write = originalStderr;
    }
  });

  test("onLine receives each log line", () => {
    const received: string[] = [];
    const logger = createLogger({
      level: "debug",
      app: "test",
      environment: "local",
      onLine: (line) => {
        received.push(line);
      },
    });
    const original = process.stdout.write.bind(process.stdout);
    process.stdout.write = (() => true) as typeof process.stdout.write;

    try {
      logger.info("logger.on-line.test");
      expect(received).toHaveLength(1);
      expect(received[0]).toContain("logger.on-line.test");
    } finally {
      process.stdout.write = original;
    }
  });
});
