import { describe, expect, test } from "bun:test";
import { parseRole } from "@core/domains/user/helpers";
import { ValidationError } from "@core/shared/errors/domain-error";

describe("Role", () => {
  test("parses known roles", () => {
    expect(parseRole("administrator")).toBe("administrator");
    expect(parseRole("manager")).toBe("manager");
    expect(parseRole("user")).toBe("user");
  });

  test("rejects unknown roles", () => {
    expect(() => parseRole("owner")).toThrow(ValidationError);
  });
});
