import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { clearRefreshToken, writeRefreshToken } from "@web/context/Auth/storage";
import * as client from "@web/utils/api/client";
import {
  clearSessionTokenCache,
  withSessionToken,
  writeSessionTokenCache,
} from "@web/utils/api/endpoints/auth";
import { ApiError } from "@web/utils/api/types";
import { resetSessionStorage } from "../setup";

const tokenPair = {
  session_token: "fresh-access-token",
  refresh_token: "refresh-token",
  expires_in: 900,
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
      session_token: "stale-access-token",
      refresh_token: "refresh-token",
      expires_in: 900,
    });

    const post = spyOn(client, "post").mockResolvedValue({
      data: tokenPair,
      errors: [],
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
    expect(post).toHaveBeenCalledTimes(1);
  });

  test("does not retry on non-401 errors", async () => {
    writeRefreshToken("refresh-token");
    writeSessionTokenCache({
      session_token: "access-token",
      refresh_token: "refresh-token",
      expires_in: 900,
    });

    const fn = mock(async () => {
      throw new ApiError(403, "forbidden");
    });

    await expect(withSessionToken(fn)).rejects.toMatchObject({ status: 403 });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
