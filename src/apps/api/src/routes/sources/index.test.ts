import { describe, expect, test } from "bun:test";
import { API } from "@ndb/platform";
import { readApiData } from "@tests/api/helpers/api-response";
import { loginViaApp } from "@tests/api/helpers/auth-services";
import { createTestApp } from "@tests/api/helpers/create-test-app";

type SourcesResponse = {
  sources: Array<{
    id: string;
    type: string;
    hasPassword?: boolean;
    password?: string;
  }>;
};

describe("sources routes", () => {
  test("PUT /api/v1/sources keeps email password when omitted", async () => {
    const { app } = await createTestApp({
      username: "srcuser1",
      password: "password123",
    });
    const token = await loginViaApp(app, "srcuser1", "password123");

    await app.request(API.sources.put, {
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
            useSsl: true,
          },
        ],
      }),
    });

    const response = await app.request(API.sources.put, {
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
    const body = await readApiData<SourcesResponse>(response);
    expect(body.sources[0]?.hasPassword).toBe(true);
    expect("password" in (body.sources[0] ?? {})).toBe(false);
  });

  test("GET /api/v1/sources returns 401 without auth", async () => {
    const { app } = await createTestApp({
      username: "srcuser2",
      password: "password123",
    });

    const response = await app.request(API.sources.get);
    expect(response.status).toBe(401);
  });
});
