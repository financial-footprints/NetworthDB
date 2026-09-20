import { describe, expect, test } from "bun:test";
import { ROLES } from "@core/domains/user/roles";

describe("Role", () => {
  test("lists the product roles", () => {
    expect([...ROLES]).toEqual(["user", "manager", "administrator"]);
  });
});
