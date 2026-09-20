import { describe, expect, test } from "bun:test";
import { API, REQUEST_ID_HEADER } from "@ndb/platform";
import { readApiJson } from "@tests/api/helpers/api-response";
import { createTestApp } from "@tests/api/helpers/create-test-app";

describe("GET /health", () => {
  test("returns health payload with injected services", async () => {
    const { app } = await createTestApp({ seedUser: false });
    const response = await app.request(API.health.get);

    expect(response.status).toBe(200);
    const body = await readApiJson<{ ok: boolean }>(response);
    expect(body).toEqual({ ok: true });
  });

  test("echoes the incoming request id header", async () => {
    const { app } = await createTestApp({ seedUser: false });
    const response = await app.request(API.health.get, {
      headers: {
        [REQUEST_ID_HEADER]: "ray-health",
      },
    });

    expect(response.headers.get(REQUEST_ID_HEADER)).toBe("ray-health");
  });

  test("serves health via Bun.serve without finalization error", async () => {
    const { app, logger } = await createTestApp({ seedUser: false });
    const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: app.fetch });

    try {
      const response = await fetch(`http://${server.hostname}:${server.port}${API.health.get}`);
      expect(response.status).toBe(200);
      expect(logger.entries.some((entry) => entry.message === "middleware.error.internal")).toBe(
        false
      );
    } finally {
      server.stop(true);
    }
  });

  test("generates a request id when one is not provided", async () => {
    const { app } = await createTestApp({ seedUser: false });
    const response = await app.request(API.health.get);

    expect(response.headers.get(REQUEST_ID_HEADER)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });
});
