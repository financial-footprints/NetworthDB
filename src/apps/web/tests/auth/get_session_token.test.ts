import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { API } from "@ndb/platform";
import { clearRefreshToken, writeRefreshToken } from "@web/context/Auth/storage";
import * as client from "@web/utils/api/client";
import {
  clearSessionTokenCache,
  getSessionToken,
  refreshSessionToken,
} from "@web/utils/api/endpoints/auth";
import { resetSessionStorage } from "../setup";

const tokenPair = {
  session_token: "access-token",
  refresh_token: "refresh-token",
  expires_in: 900,
};

describe("getSessionToken", () => {
  afterEach(() => {
    mock.restore();
    clearSessionTokenCache();
    clearRefreshToken();
    resetSessionStorage();
  });

  test("reuses cached access token without calling refresh", async () => {
    writeRefreshToken("refresh-token");
    const post = spyOn(client, "post").mockResolvedValue({
      data: tokenPair,
      errors: [],
    });

    const first = await getSessionToken();
    const second = await getSessionToken();

    expect(first).toBe("access-token");
    expect(second).toBe("access-token");
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(API.auth.session.refresh, {
      refresh_token: "refresh-token",
    });
  });

  test("refreshes when cached token is within expiry skew", async () => {
    const base = 5_000_000;
    const dateNow = spyOn(Date, "now").mockReturnValue(base);
    writeRefreshToken("refresh-token");
    const post = spyOn(client, "post")
      .mockResolvedValueOnce({
        data: { ...tokenPair, session_token: "first-token" },
        errors: [],
      })
      .mockResolvedValueOnce({
        data: { ...tokenPair, session_token: "second-token" },
        errors: [],
      });

    const first = await getSessionToken();
    expect(first).toBe("first-token");
    expect(post).toHaveBeenCalledTimes(1);

    dateNow.mockReturnValue(base + 900_000 - 59_000);
    const second = await getSessionToken();
    expect(second).toBe("second-token");
    expect(post).toHaveBeenCalledTimes(2);
  });

  test("refreshSessionToken dedupes concurrent refresh calls", async () => {
    writeRefreshToken("refresh-token");
    const post = spyOn(client, "post").mockResolvedValue({
      data: tokenPair,
      errors: [],
    });

    const [left, right] = await Promise.all([refreshSessionToken(), refreshSessionToken()]);

    expect(left).toEqual(tokenPair);
    expect(right).toEqual(tokenPair);
    expect(post).toHaveBeenCalledTimes(1);
  });
});
