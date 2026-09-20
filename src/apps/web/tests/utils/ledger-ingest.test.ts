import { describe, expect, test } from "bun:test";
import { extractEnqueuedJobId } from "@web/utils/transactions";

describe("complete statement job helpers", () => {
  test("extractEnqueuedJobId reads { jobId } only", () => {
    expect(extractEnqueuedJobId({ jobId: "job-upload" })).toBe("job-upload");
    expect(extractEnqueuedJobId(undefined)).toBeUndefined();
  });
});
