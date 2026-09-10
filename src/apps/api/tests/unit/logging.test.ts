import { describe, expect, test } from "bun:test";
import { createApp } from "@ndb/api";
import { API } from "@ndb/platform";
import { fakeConfig, fakeServices } from "@tests/api/helpers/config";
import { createMemoryLogger } from "@tests/api/helpers/memory.logger";

describe("logging middleware", () => {
  test("records successful http requests with dotted keys", async () => {
    const logger = createMemoryLogger();
    const app = createApp({
      config: fakeConfig(),
      logger,
      services: fakeServices(),
    });

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
