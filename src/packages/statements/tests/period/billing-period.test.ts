import { describe, expect, test } from "bun:test";
import { approxStartFromEnd } from "@statements/period/billing-period";

describe("approxStartFromEnd", () => {
  test("approxStartFromEnd", () => {
    expect(approxStartFromEnd("2025-01-31")).toBe("2025-01-01");
    expect(approxStartFromEnd("2023-06-16")).toBe("2023-05-17");
  });
});
