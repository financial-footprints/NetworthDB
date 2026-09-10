import { describe, expect, test } from "bun:test";
import { seedHashPassword, verifyPassword } from "@core/domains/auth/embedded/password";

const LOCAL_ADMIN_PASSWORD = "admin";

describe("seedHashPassword", () => {
  test("verifies the local admin password", async () => {
    const passwordHash = await seedHashPassword(LOCAL_ADMIN_PASSWORD);
    expect(await verifyPassword(LOCAL_ADMIN_PASSWORD, passwordHash)).toBe(true);
    expect(await verifyPassword("wrong", passwordHash)).toBe(false);
  });

  test("is deterministic", async () => {
    const first = await seedHashPassword(LOCAL_ADMIN_PASSWORD);
    const second = await seedHashPassword(LOCAL_ADMIN_PASSWORD);
    expect(first).toBe(second);
  });
});
