import { describe, expect, test } from "bun:test";
import { isRole } from "@core/domains/user/helpers";

describe("Role", () => {
  test("recognizes known roles", () => {
    expect(isRole("administrator")).toBe(true);
    expect(isRole("manager")).toBe(true);
    expect(isRole("user")).toBe(true);
  });

  test("rejects unknown roles", () => {
    expect(isRole("owner")).toBe(false);
  });
});
