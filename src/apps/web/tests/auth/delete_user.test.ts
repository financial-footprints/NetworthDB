import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { API } from "@ndb/platform";
import { clearRefreshToken, writeRefreshToken } from "@web/context/Auth/storage";
import * as client from "@web/utils/api/client";
import { clearSessionTokenCache, deleteUser } from "@web/utils/api/endpoints/auth";
import { canDeleteUsers } from "@web/utils/api/endpoints/auth/types";
import { apiPath } from "@web/utils/api/path";
import { resetSessionStorage } from "../setup";

const tokenPair = {
  session_token: "access-token",
  refresh_token: "refresh-token",
  expires_in: 900,
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
  afterEach(() => {
    mock.restore();
    clearSessionTokenCache();
    clearRefreshToken();
    resetSessionStorage();
  });

  test("calls delete endpoint with refreshed access token", async () => {
    writeRefreshToken("existing-refresh");

    const post = spyOn(client, "post").mockImplementation((async (path) => {
      if (path === API.auth.session.refresh) {
        return { data: tokenPair, errors: [] };
      }
      throw new Error(`unexpected post path: ${path}`);
    }) as typeof client.post);

    const del = spyOn(client, "del").mockResolvedValue({
      data: null,
      errors: [],
    });

    await deleteUser("user-1");

    expect(post).toHaveBeenCalledWith(API.auth.session.refresh, {
      refresh_token: "existing-refresh",
    });
    expect(del).toHaveBeenCalledWith(apiPath(API.users.details, { id: "user-1" }), {
      sessionToken: "access-token",
    });
  });
});
