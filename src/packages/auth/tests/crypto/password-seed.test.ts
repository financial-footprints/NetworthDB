import { describe, expect, test } from "bun:test";
import { createPasswordHasher, seedHashPassword } from "@auth/crypto/password";

describe("seedHashPassword", () => {
  test("produces deterministic seed hashes", async () => {
    const first = await seedHashPassword("admin");
    const second = await seedHashPassword("admin");
    expect(first).toBe(second);
  });

  test("seed hash differs from runtime hash", async () => {
    const hasher = createPasswordHasher();
    const seed = await seedHashPassword("admin");
    const runtime = await hasher.hash("admin");
    expect(seed).not.toBe(runtime);
  });
});
