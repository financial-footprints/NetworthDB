import { describe, expect, test } from "bun:test";
import { jobWarningOutputs } from "@core/domains/jobs/embedded/output";

describe("jobOutputFromWarnings", () => {
  test("returns empty warnings for empty input", () => {
    expect(jobWarningOutputs([])).toEqual({ warnings: [] });
  });

  test("returns structured output for warnings", () => {
    const output = jobWarningOutputs([
      {
        kind: "parse.warning",
        message: "Something happened",
        account: "acct-1",
        sourceFile: "statement.pdf",
        textContains: ["balance"],
      },
    ]);

    expect(output).toEqual({
      warnings: [
        {
          kind: "parse.warning",
          message: "Something happened",
          account: "acct-1",
          sourceFile: "statement.pdf",
          textContains: ["balance"],
        },
      ],
    });
  });
});
