import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { API } from "@ndb/platform";
import { resetSessionStorage } from "@tests/web/setup";
import { clearRefreshToken, writeRefreshToken } from "@web/contexts/Auth/storage";
import * as client from "@web/utils/api/client";
import { clearSessionTokenCache, registerUser } from "@web/utils/api/routes/auth";
import { canCreateUsers } from "@web/utils/api/routes/auth/types";

const tokenPair = {
  sessionToken: "access-token",
  refreshToken: "refresh-token",
  expiresIn: 900,
};

const createdUser = {
  id: "user-1",
  username: "alice",
  role: "manager" as const,
  createdAt: "2026-01-01T00:00:00Z",
  multifactorEnabled: false,
};

describe("canCreateUsers", () => {
  test("returns true only for administrator", () => {
    expect(canCreateUsers("administrator")).toBe(true);
    expect(canCreateUsers("manager")).toBe(false);
    expect(canCreateUsers("user")).toBe(false);
    expect(canCreateUsers("")).toBe(false);
  });
});

describe("registerUser", () => {
  afterEach(() => {
    mock.restore();
    clearSessionTokenCache();
    clearRefreshToken();
    resetSessionStorage();
  });

  test("posts payload to register endpoint with refreshed access token", async () => {
    writeRefreshToken("existing-refresh");

    const apiRequest = spyOn(client, "apiRequest").mockImplementation((async (path, _options) => {
      if (path === API.auth.session.refresh) {
        return { data: tokenPair };
      }
      if (path === API.users.create) {
        return { data: createdUser };
      }
      throw new Error(`unexpected path: ${path}`);
    }) as typeof client.apiRequest);

    const result = await registerUser({
      username: "alice",
      password: "password123",
      role: "manager",
    });

    expect(apiRequest).toHaveBeenCalledWith(
      API.users.create,
      expect.objectContaining({
        method: "POST",
        sessionToken: "access-token",
        body: {
          username: "alice",
          password: "password123",
          role: "manager",
        },
      })
    );
    expect(result).toEqual(createdUser);
  });
});
