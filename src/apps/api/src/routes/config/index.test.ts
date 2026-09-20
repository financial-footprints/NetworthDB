import { describe, expect, test } from "bun:test";
import { createApp } from "@ndb/api";
import { API } from "@ndb/platform";
import { fakeConfig } from "@tests/api/helpers/config";
import { createMemoryLogger } from "@tests/api/helpers/memory-logger";

describe("config route", () => {
  test("GET /api/v1/config returns advancedSecurity flag", async () => {
    const app = createApp({
      config: {
        ...fakeConfig(),
        advancedSecurity: {
          disabled: true,
          pipelineTrace: true,
          sensitiveBackups: true,
        },
      },
      logger: createMemoryLogger(),
      services: {
        healthService: { check: async () => ({ ok: true }) },
      } as never,
    });

    const response = await app.request(API.config.get);
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { advancedSecurity: { disabled: boolean } };
    };
    expect(body.data.advancedSecurity.disabled).toBe(true);
  });
});
