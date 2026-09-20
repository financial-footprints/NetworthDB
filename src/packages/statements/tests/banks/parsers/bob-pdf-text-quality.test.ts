import { describe, expect, test } from "bun:test";
import {
  bobStatementTextMayBeIncomplete,
  countBobTxnLikeLines,
} from "@statements/banks/institutions/bob/shared/helpers";

describe("bob pdf text quality", () => {
  test("counts BBPS and ref transaction lines", () => {
    const text = [
      "16/09/2024   BBPS-PAYMENT   INR   1,004.00   1,004.00   CR",
      "18/08/2024   R92485   SIGNAL FOUNDATION   840   0   INR   200.00   200.00   DR",
    ].join("\n");
    expect(countBobTxnLikeLines(text)).toBe(2);
  });

  test("flags multi-page PDF text with no transactions in details section", () => {
    const text = [
      "Page 1 of 4",
      "Transaction Details",
      "Date Ref. No. Particulars",
      "Page 2 of 4",
    ].join("\n");
    expect(bobStatementTextMayBeIncomplete(text)).toBe(true);
  });

  test("does not flag when transactions are present in Transaction Details", () => {
    const text = [
      "Page 1 of 4",
      "Transaction Details",
      "16/09/2024   BBPS-PAYMENT   INR   1,004.00   1,004.00   CR",
    ].join("\n");
    expect(bobStatementTextMayBeIncomplete(text)).toBe(false);
  });

  test("does not flag when transactions appear only after page 1 footer", () => {
    const text = [
      "Page 1 of 4",
      "Transaction Details",
      "Date Ref. No. Particulars",
      "18/08/2024   R92485   SIGNAL FOUNDATION   840   0   INR   200.00   200.00   DR",
      "Page 2 of 4",
    ].join("\n");
    expect(bobStatementTextMayBeIncomplete(text)).toBe(false);
  });
});
