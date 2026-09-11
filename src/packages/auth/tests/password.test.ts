import { describe, expect, test } from "bun:test";
import { createPasswordHasher } from "@auth/password";

describe("createPasswordHasher", () => {
  test("hashes and verifies passwords", async () => {
    const hasher = createPasswordHasher();
    const hash = await hasher.hash("password123");
    expect(await hasher.verify("password123", hash)).toBe(true);
    expect(await hasher.verify("wrong", hash)).toBe(false);
  });
});
