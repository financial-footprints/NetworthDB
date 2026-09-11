import { describe, expect, test } from "bun:test";
import { createApp } from "@ndb/api";
import { API } from "@ndb/platform";
import { readApiJson } from "@tests/api/helpers/api-response";
import { createAuthTestServices, loginViaApp } from "@tests/api/helpers/auth-services";
import { fakeConfig } from "@tests/api/helpers/config";
import { createMemoryLogger } from "@tests/api/helpers/memory.logger";

type SourcesResponse = {
  sources: Array<{
    id: string;
    type: string;
    has_password?: boolean;
    password?: string;
  }>;
};

describe("sources routes", () => {
  test("PUT /api/v1/sources keeps email password when omitted", async () => {
    const services = await createAuthTestServices("srcuser1", "password123");
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });
    const token = await loginViaApp(app, "srcuser1", "password123");

    await app.request(API.sources, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sources: [
          {
            id: "imap-1",
            type: "email",
            label: "Work Gmail",
            host: "imap.example.test",
            port: 993,
            username: "user@example.test",
            password: "imap-secret",
            folder: "INBOX",
            use_ssl: true,
          },
        ],
      }),
    });

    const response = await app.request(API.sources, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sources: [
          {
            id: "imap-1",
            type: "email",
            label: "Work Gmail",
            host: "imap.example.test",
            username: "user@example.test",
          },
        ],
      }),
    });

    expect(response.status).toBe(200);
    const body = await readApiJson<SourcesResponse>(response);
    expect(body.data.sources[0]?.has_password).toBe(true);
    expect("password" in (body.data.sources[0] ?? {})).toBe(false);
  });

  test("GET /api/v1/sources returns 401 without auth", async () => {
    const services = await createAuthTestServices("srcuser2", "password123");
    const app = createApp({
      config: fakeConfig(),
      logger: createMemoryLogger(),
      services,
    });

    const response = await app.request(API.sources);
    expect(response.status).toBe(401);
  });
});
