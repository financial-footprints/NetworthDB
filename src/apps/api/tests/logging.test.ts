import { describe, expect, test } from "bun:test";
import { API } from "@ndb/platform";
import { createTestApp } from "@tests/api/helpers/create-test-app";

describe("logging middleware", () => {
  test("records successful http requests with dotted keys", async () => {
    const { app, logger } = await createTestApp({ seedUser: false });

    await app.request(API.health.get);

    expect(logger.entries).toEqual([
      expect.objectContaining({
        level: "info",
        message: "middleware.http.ok",
        context: expect.objectContaining({
          method: "GET",
          path: API.health.get,
          status: 200,
          rayId: expect.any(String),
        }),
      }),
    ]);
    expect(logger.entries.some((entry) => entry.message === "middleware.error.internal")).toBe(
      false
    );
  });
});
