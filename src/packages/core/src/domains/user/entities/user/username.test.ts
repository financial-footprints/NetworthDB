import { describe, expect, test } from "bun:test";
import { Username } from "@core/domains/user/entities/user/index";
import { ValidationError } from "@core/shared/errors/domain-error";

describe("Username", () => {
  test("normalizes to lowercase", () => {
    expect(Username.parse("Alice_01").toString()).toBe("alice_01");
  });

  test("rejects too short", () => {
    expect(() => Username.parse("ab")).toThrow(ValidationError);
  });

  test("rejects invalid characters", () => {
    expect(() => Username.parse("bad-name")).toThrow(ValidationError);
  });

  test("rejects empty", () => {
    expect(() => Username.parse("")).toThrow(ValidationError);
  });
});
