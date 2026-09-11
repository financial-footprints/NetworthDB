import { describe, expect, spyOn, test } from "bun:test";
import { log, sanitize } from "@web/logging";

describe("logging", () => {
  test("sanitize drops email", () => {
    expect(sanitize({ email: "a@b.com", user_id: "x" })).toEqual({
      user_id: "x",
    });
  });

  test("warn writes a json line", () => {
    const spy = spyOn(console, "warn").mockImplementation(() => undefined);
    log("warn", "@ndb/web.api.request.failed", {
      status: 500,
      path: "/api",
    });
    expect(spy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(spy.mock.calls[0]?.[0])) as {
      service: string;
      level: string;
      message: string;
      status: number;
    };
    expect(payload.service).toBe("networthdb");
    expect(payload.level).toBe("warn");
    expect(payload.message).toBe("@ndb/web.api.request.failed");
    expect(payload.status).toBe(500);
    spy.mockRestore();
  });
});
