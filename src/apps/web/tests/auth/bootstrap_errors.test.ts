import { describe, expect, test } from "bun:test";
import { shouldClearSessionOnBootstrapError } from "@web/context/Auth/helpers";
import { ApiError } from "@web/utils/api/types";

describe("shouldClearSessionOnBootstrapError", () => {
  test("keeps refresh token on 429 rate limit", () => {
    expect(shouldClearSessionOnBootstrapError(new ApiError(429, "rate limited"))).toBe(false);
  });

  test("keeps refresh token on 5xx server errors", () => {
    expect(shouldClearSessionOnBootstrapError(new ApiError(500, "server error"))).toBe(false);
    expect(shouldClearSessionOnBootstrapError(new ApiError(503, "unavailable"))).toBe(false);
  });

  test("clears session on 401 invalid refresh", () => {
    expect(shouldClearSessionOnBootstrapError(new ApiError(401, "unauthorized"))).toBe(true);
  });

  test("clears session on other client errors", () => {
    expect(shouldClearSessionOnBootstrapError(new ApiError(403, "forbidden"))).toBe(true);
  });

  test("clears session on non-API errors", () => {
    expect(shouldClearSessionOnBootstrapError(new Error("not authenticated"))).toBe(true);
  });
});
