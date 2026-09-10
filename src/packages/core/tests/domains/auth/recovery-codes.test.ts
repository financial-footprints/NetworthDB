import { describe, expect, test } from "bun:test";
import {
  formatDashedRecoveryCode,
  generateRecoveryCodes,
  hashRecoveryCode,
  normalizeRecoverySecret,
  RECOVERY_CODE_COUNT,
} from "@core/domains/auth/modules/recovery/embedded/recovery-codes";

describe("recovery-codes", () => {
  test("formats dashed codes and hashes normalized secrets", () => {
    const formatted = formatDashedRecoveryCode("abcdefghijklmnop");
    expect(formatted).toBe("ABCD-EFGH-IJKL-MNOP");
    expect(normalizeRecoverySecret("abcd-efgh-ijkl-mnop")).toBe("ABCDEFGHIJKLMNOP");
    expect(hashRecoveryCode("abcd-efgh-ijkl-mnop")).toMatch(/^[0-9a-f]{64}$/);
  });

  test("generates ten unique recovery codes", () => {
    const generated = generateRecoveryCodes();
    expect(generated.plain).toHaveLength(RECOVERY_CODE_COUNT);
    expect(generated.hashes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(new Set(generated.plain).size).toBe(RECOVERY_CODE_COUNT);
    expect(new Set(generated.hashes).size).toBe(RECOVERY_CODE_COUNT);
  });
});
