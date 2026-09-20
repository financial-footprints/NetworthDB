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

  test("stores an explicit catalog title when provided", () => {
    const account = Account.create({
      userId: "00000000-0000-4000-8000-000000000001",
      accountType: "credit_card",
      bank: "bob",
      variant: "easy",
      openingDate: "2020-01-15",
      accountNumber: "4111",
      passwords: [],
      label: "Easy Shopping",
    });
    expect(account.label).toBe("Easy Shopping");
  });
});
