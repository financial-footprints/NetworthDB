import { describe, expect, test } from "bun:test";
import { JobScope } from "@core/domains/jobs/embedded/scope";

describe("JobScope.toCanonicalJson", () => {
  test("empty scope serializes to {}", () => {
    expect(JobScope.empty().toCanonicalJson()).toBe("{}");
  });

  test("sorts keys for stable conflict index", () => {
    expect(
      JobScope.create({
        accountId: "abcd",
        financialYear: "FY23-2024",
      }).toCanonicalJson()
    ).toBe('{"account_id":"abcd","financial_year":"FY23-2024"}');
  });
});
