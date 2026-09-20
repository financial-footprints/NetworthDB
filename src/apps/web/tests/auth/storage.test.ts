import { afterEach, describe, expect, test } from "bun:test";
import { resetSessionStorage } from "@tests/web/setup";
import { clearRefreshToken, readRefreshToken, writeRefreshToken } from "@web/contexts/Auth/storage";

describe("auth storage", () => {
  afterEach(() => {
    clearRefreshToken();
    resetSessionStorage();
  });

  test("readRefreshToken returns null when unset", () => {
    expect(readRefreshToken()).toBeNull();
  });

  test("writeRefreshToken stores and readRefreshToken retrieves the token", () => {
    writeRefreshToken("refresh-token-123");
    expect(readRefreshToken()).toBe("refresh-token-123");
  });

  test("clearRefreshToken removes the stored token", () => {
    writeRefreshToken("refresh-token-123");
    clearRefreshToken();
    expect(readRefreshToken()).toBeNull();
  });
});
