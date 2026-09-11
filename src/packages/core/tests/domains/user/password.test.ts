import { describe, expect, test } from "bun:test";
import { Password } from "@core/domains/user/entities/user/password";
import { ValidationError } from "@core/shared/errors/domain-error";

describe("Password.parse", () => {
  test("accepts valid local password", () => {
    expect(() => Password.parse("password", "local")).not.toThrow();
  });

  test("rejects short local password", () => {
    expect(() => Password.parse("short", "local")).toThrow(ValidationError);
  });

  test("rejects weak production password", () => {
    expect(() => Password.parse("passwordpassword", "production")).toThrow(ValidationError);
    expect(() => Password.parse("Password123!", "production")).not.toThrow();
  });
});
