import { describe, expect, test } from "bun:test";
import { validatePassword } from "@core/domains/auth/embedded/password";
import { ValidationError } from "@core/shared/errors/domain-error";

describe("validatePassword", () => {
  test("accepts an 8-character password in local", () => {
    expect(() => validatePassword("password", "local")).not.toThrow();
  });

  test("rejects a short password in local", () => {
    expect(() => validatePassword("short", "local")).toThrow(ValidationError);
  });

  test("requires complexity in production", () => {
    expect(() => validatePassword("passwordpassword", "production")).toThrow(ValidationError);
    expect(() => validatePassword("Password123!", "production")).not.toThrow();
  });
});
