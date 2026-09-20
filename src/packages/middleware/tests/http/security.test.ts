import { describe, expect, test } from "bun:test";
import { security } from "@ndb/middleware";
import { Hono } from "hono";

describe("security middleware", () => {
  test("returns 413 PAYLOAD_TOO_LARGE when Content-Length exceeds limit", async () => {
    const app = new Hono();
    app.use("*", security());
    app.post("/api/v1/test", (c) => c.json({ ok: true }));

    const response = await app.request("/api/v1/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": String(128 * 1024),
      },
      body: "{}",
    });

    expect(response.status).toBe(413);
    const body = await response.json();
    expect(body).toEqual({
      error: "Request body is too large.",
      code: "PAYLOAD_TOO_LARGE",
    });
  });
});
