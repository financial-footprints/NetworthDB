import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import {
  clearSessionTokenCache,
  readCachedSessionToken,
  writeSessionTokenCache,
} from "@web/utils/api/endpoints/auth/sessionTokens";

const tokenPair = {
  session_token: "cached-access-token",
  refresh_token: "refresh",
  expires_in: 900,
};

afterEach(() => {
  mock.restore();
  clearSessionTokenCache();
});

describe("access token cache", () => {
  test("readCachedSessionToken returns null when cache is empty", () => {
    expect(readCachedSessionToken()).toBeNull();
  });

  test("writeSessionTokenCache stores token until skew before expiry", () => {
    const now = 1_000_000;
    const dateNow = spyOn(Date, "now").mockReturnValue(now);
    writeSessionTokenCache(tokenPair);
    dateNow.mockRestore();

    expect(readCachedSessionToken(now)).toBe("cached-access-token");
    expect(readCachedSessionToken(now + 900_000 - 60_001)).toBe("cached-access-token");
    expect(readCachedSessionToken(now + 900_000 - 60_000)).toBeNull();
  });

  test("clearSessionTokenCache removes cached token", () => {
    writeSessionTokenCache(tokenPair);
    clearSessionTokenCache();
    expect(readCachedSessionToken()).toBeNull();
  });
});
