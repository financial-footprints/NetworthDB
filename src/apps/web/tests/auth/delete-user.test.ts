import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { API, apiPath } from "@ndb/platform";
import { resetSessionStorage } from "@tests/web/setup";
import { clearRefreshToken, writeRefreshToken } from "@web/contexts/Auth/storage";
import * as client from "@web/utils/api/client";
import { deleteUser, resetAuthSessionState } from "@web/utils/api/routes/auth";
import { canDeleteUsers } from "@web/utils/api/routes/auth/types";

const tokenPair = {
  sessionToken: "access-token",
  refreshToken: "refresh-token",
  expiresIn: 900,
};

describe("canDeleteUsers", () => {
  test("returns true only for administrator", () => {
    expect(canDeleteUsers("administrator")).toBe(true);
    expect(canDeleteUsers("manager")).toBe(false);
    expect(canDeleteUsers("user")).toBe(false);
    expect(canDeleteUsers("")).toBe(false);
  });
});

describe("deleteUser", () => {
  beforeEach(() => {
    resetAuthSessionState();
    clearRefreshToken();
    resetSessionStorage();
  });

  afterEach(() => {
    mock.restore();
    resetAuthSessionState();
    clearRefreshToken();
    resetSessionStorage();
  });

  test("calls delete endpoint with refreshed access token", async () => {
    writeRefreshToken("existing-refresh");

    const apiRequest = spyOn(client, "apiRequest").mockImplementation((async (path, options) => {
      if (path === API.auth.session.refresh) {
        return { data: tokenPair };
      }
      if (
        path === apiPath(API.users.delete, { userId: "user-1" }) &&
        options?.method === "DELETE"
      ) {
        return undefined;
      }
      throw new Error(`unexpected apiRequest: ${path}`);
    }) as typeof client.apiRequest);

    await deleteUser("user-1");

    expect(apiRequest).toHaveBeenCalledTimes(2);
    expect(apiRequest.mock.calls[0]?.[0]).toBe(API.auth.session.refresh);
    expect(apiRequest.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      body: { refreshToken: "existing-refresh" },
    });
    expect(apiRequest).toHaveBeenCalledWith(apiPath(API.users.delete, { userId: "user-1" }), {
      method: "DELETE",
      sessionToken: "access-token",
    });
  });
});
