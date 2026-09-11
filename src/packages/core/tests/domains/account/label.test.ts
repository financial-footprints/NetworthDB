import { describe, expect, test } from "bun:test";
import { Account } from "@core/domains/account/entities/account";

describe("Account label", () => {
  test("uses bank only when variant is default", () => {
    expect(Account.generateLabel("HDFC", "default")).toBe("HDFC");
    expect(Account.normalize.variant("default")).toBeNull();
  });

  test("includes variant in label", () => {
    expect(Account.generateLabel("HDFC", "Regalia")).toBe("HDFC (Regalia)");
  });
});
