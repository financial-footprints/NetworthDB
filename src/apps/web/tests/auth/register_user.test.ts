import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { API } from "@ndb/platform";
import { clearRefreshToken, writeRefreshToken } from "@web/context/Auth/storage";
import * as client from "@web/utils/api/client";
import { clearSessionTokenCache, registerUser } from "@web/utils/api/endpoints/auth";
import { canCreateUsers } from "@web/utils/api/endpoints/auth/types";
import { resetSessionStorage } from "../setup";

const tokenPair = {
  session_token: "access-token",
  refresh_token: "refresh-token",
  expires_in: 900,
};

const createdUser = {
  id: "user-1",
  username: "alice",
  role: "user",
  created_at: "2026-01-01T00:00:00Z",
  multifactor_enabled: false,
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

    const post = spyOn(client, "post").mockImplementation((async (path) => {
      if (path === API.auth.session.refresh) {
        return { data: tokenPair, errors: [] };
      }
      if (path === API.users.create) {
        return { data: createdUser, errors: [] };
      }
      throw new Error(`unexpected path: ${path}`);
    }) as typeof client.post);

    const result = await registerUser({
      username: "alice",
      password: "password123",
      role: "manager",
    });

    expect(post).toHaveBeenCalledWith(
      API.users.create,
      {
        username: "alice",
        password: "password123",
        role: "manager",
      },
      { sessionToken: "access-token" }
    );
    expect(result).toEqual(createdUser);
  });
});
