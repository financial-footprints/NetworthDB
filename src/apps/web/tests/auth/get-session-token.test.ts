import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { API } from "@ndb/platform";
import { resetSessionStorage } from "@tests/web/setup";
import { clearRefreshToken, writeRefreshToken } from "@web/contexts/Auth/storage";
import * as client from "@web/utils/api/client";
import {
  getSessionToken,
  refreshSessionToken,
  resetAuthSessionState,
} from "@web/utils/api/routes/auth";

const tokenPair = {
  sessionToken: "access-token",
  refreshToken: "refresh-token",
  expiresIn: 900,
};

describe("getSessionToken", () => {
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

  test("reuses cached access token without calling refresh", async () => {
    writeRefreshToken("refresh-token");
    const apiRequest = spyOn(client, "apiRequest").mockResolvedValue({
      data: tokenPair,
    });

    const first = await getSessionToken();
    const second = await getSessionToken();

    expect(first).toBe("access-token");
    expect(second).toBe("access-token");
    expect(apiRequest).toHaveBeenCalledTimes(1);
    expect(apiRequest.mock.calls[0]?.[0]).toBe(API.auth.session.refresh);
    expect(apiRequest.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      body: { refreshToken: "refresh-token" },
    });
  });

  test("refreshes when cached token is within expiry skew", async () => {
    const base = 5_000_000;
    const dateNow = spyOn(Date, "now").mockReturnValue(base);
    writeRefreshToken("refresh-token");
    const apiRequest = spyOn(client, "apiRequest")
      .mockResolvedValueOnce({
        data: { ...tokenPair, sessionToken: "first-token" },
      })
      .mockResolvedValueOnce({
        data: { ...tokenPair, sessionToken: "second-token" },
      });

    const first = await getSessionToken();
    expect(first).toBe("first-token");
    expect(apiRequest).toHaveBeenCalledTimes(1);

    dateNow.mockReturnValue(base + 900_000 - 59_000);
    const second = await getSessionToken();
    expect(second).toBe("second-token");
    expect(apiRequest).toHaveBeenCalledTimes(2);
  });

  test("refreshSessionToken dedupes concurrent refresh calls", async () => {
    writeRefreshToken("refresh-token");
    const apiRequest = spyOn(client, "apiRequest").mockResolvedValue({
      data: tokenPair,
    });

    const [left, right] = await Promise.all([refreshSessionToken(), refreshSessionToken()]);

    expect(left).toEqual(tokenPair);
    expect(right).toEqual(tokenPair);
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });
});
