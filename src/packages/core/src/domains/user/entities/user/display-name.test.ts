import { describe, expect, test } from "bun:test";
import { DisplayName } from "@core/domains/user/entities/user/display-name";
import { ValidationError } from "@core/shared/errors/domain-error";

describe("DisplayName.parse", () => {
  test("accepts valid display name", () => {
    expect(DisplayName.parse("abc.def").toString()).toBe("abc.def");
  });

  test("rejects empty display name", () => {
    expect(() => DisplayName.parse("   ")).toThrow(ValidationError);
  });
});

describe("DisplayName.parseOptional", () => {
  test("returns null for omitted or blank input", () => {
    expect(DisplayName.parseOptional()).toBeNull();
    expect(DisplayName.parseOptional(null)).toBeNull();
    expect(DisplayName.parseOptional("   ")).toBeNull();
  });

  test("parses non-empty input", () => {
    expect(DisplayName.parseOptional(" Alice ")?.toString()).toBe("Alice");
  });
});

describe("DisplayName.fromPersisted", () => {
  test("trusts stored value without re-validating", () => {
    expect(DisplayName.fromPersisted("stored-name").toString()).toBe("stored-name");
  });
});
