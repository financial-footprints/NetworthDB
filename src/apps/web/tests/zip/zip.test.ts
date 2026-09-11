import { describe, expect, test } from "bun:test";
import { ACCOUNTS_JSON_NAME } from "@ndb/platform";
import { Zip } from "@web/utils/zip";

describe("Zip", () => {
  test("create and open round-trip without password", async () => {
    const files = {
      [ACCOUNTS_JSON_NAME]: '[{"bank":"onecard"}]\n',
    };
    const archive = await Zip.create(files);
    const opened = await Zip.open(archive);
    expect(opened[ACCOUNTS_JSON_NAME]).toBe(files[ACCOUNTS_JSON_NAME]);
  });

  test("create and open round-trip with password", async () => {
    const files = {
      [ACCOUNTS_JSON_NAME]: '[{"bank":"onecard","passwords":["secret"]}]\n',
    };
    const archive = await Zip.create(files, { password: "backup-secret" });
    const opened = await Zip.open(archive, { password: "backup-secret" });
    expect(opened[ACCOUNTS_JSON_NAME]).toBe(files[ACCOUNTS_JSON_NAME]);
  });
});
