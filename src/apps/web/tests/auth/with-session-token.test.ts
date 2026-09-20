import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { resetSessionStorage } from "@tests/web/setup";
import { clearRefreshToken, writeRefreshToken } from "@web/contexts/Auth/storage";
import * as client from "@web/utils/api/client";
import {
  clearSessionTokenCache,
  withSessionToken,
  writeSessionTokenCache,
} from "@web/utils/api/routes/auth";
import { ApiError } from "@web/utils/api/types";

const tokenPair = {
  sessionToken: "fresh-access-token",
  refreshToken: "refresh-token",
  expiresIn: 900,
};

describe("withSessionToken", () => {
  afterEach(() => {
    mock.restore();
    clearSessionTokenCache();
    clearRefreshToken();
    resetSessionStorage();
  });

  test("retries once after 401 by invalidating cache and refreshing", async () => {
    writeRefreshToken("refresh-token");
    writeSessionTokenCache({
      sessionToken: "stale-access-token",
      refreshToken: "refresh-token",
      expiresIn: 900,
    });

    const apiRequest = spyOn(client, "apiRequest").mockResolvedValue({
      data: tokenPair,
    });

    const fn = mock(async (sessionToken: string) => {
      if (sessionToken === "stale-access-token") {
        throw new ApiError(401, "unauthorized");
      }
      return "ok";
    });

    const result = await withSessionToken(fn);

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn.mock.calls[0]?.[0]).toBe("stale-access-token");
    expect(fn.mock.calls[1]?.[0]).toBe("fresh-access-token");
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });

  test("does not retry on non-401 errors", async () => {
    writeRefreshToken("refresh-token");
    writeSessionTokenCache({
      sessionToken: "access-token",
      refreshToken: "refresh-token",
      expiresIn: 900,
    });

    const fn = mock(async () => {
      throw new ApiError(403, "forbidden");
    });

    await expect(withSessionToken(fn)).rejects.toMatchObject({ status: 403 });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
