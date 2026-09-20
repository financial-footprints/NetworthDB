import { describe, expect, test } from "bun:test";
import { serializeJob, serializeJobList } from "@api/routes/jobs/serializer";
import { Job, JobScope } from "@ndb/core";

function sampleJob(): Job {
  return new Job(
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
    "sync",
    "completed",
    JobScope.create({ accountId: "acct-1" }),
    new Date("2026-01-01T00:00:00.000Z"),
    new Date("2026-01-01T00:00:05.000Z"),
    { warnings: [] },
    null,
    '{"time":"2026-01-01T00:00:01.000Z","level":"info","msg":"extract stage started","stage":"extract"}'
  );
}

describe("jobs serializer", () => {
  test("serializeJob includes logs on detail responses", () => {
    const body = serializeJob(sampleJob());
    expect(body.data.logs).toBe(
      '{"time":"2026-01-01T00:00:01.000Z","level":"info","msg":"extract stage started","stage":"extract"}'
    );
  });

  test("serializeJobList omits logs from list items", () => {
    const body = serializeJobList([sampleJob()], 1);
    expect(body.items[0]).not.toHaveProperty("logs");
  });
});
