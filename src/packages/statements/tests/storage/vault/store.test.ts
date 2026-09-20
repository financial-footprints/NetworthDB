import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { VaultStore } from "@statements/storage/vault/store";

const DATA_KEY = Buffer.from(
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "hex"
);

describe("VaultStore", () => {
  let tenantRoot = "";

  afterEach(() => {
    if (tenantRoot) {
      rmSync(tenantRoot, { recursive: true, force: true });
      tenantRoot = "";
    }
  });

  test("plaintext round trip", () => {
    tenantRoot = mkdtempSync(join(tmpdir(), "ndb-vault-plain-"));
    const store = new VaultStore({
      tenantRoot,
      encryptAtRest: false,
      dataKey: null,
    });

    store.writeBytes("FY24-2025/credit_card/acct/2025.pdf", Buffer.from("pdf-bytes"));
    expect(store.readBytes("FY24-2025/credit_card/acct/2025.pdf")?.toString()).toBe("pdf-bytes");
    expect(store.exists("FY24-2025/credit_card/acct/2025.pdf")).toBe(true);
    expect(store.list("FY24-2025")).toEqual(["FY24-2025/credit_card/acct/2025.pdf"]);
  });

  test("encrypted round trip", () => {
    tenantRoot = mkdtempSync(join(tmpdir(), "ndb-vault-enc-"));
    const store = new VaultStore({
      tenantRoot,
      encryptAtRest: true,
      dataKey: DATA_KEY,
    });

    store.writeBytes("FY24-2025/credit_card/acct/2025.pdf", Buffer.from("secret"));
    expect(store.readBytes("FY24-2025/credit_card/acct/2025.pdf")?.toString()).toBe("secret");
    expect(store.exists("FY24-2025/credit_card/acct/2025.pdf")).toBe(true);
  });

  test("missing read returns null", () => {
    tenantRoot = mkdtempSync(join(tmpdir(), "ndb-vault-missing-"));
    const store = new VaultStore({
      tenantRoot,
      encryptAtRest: false,
      dataKey: null,
    });

    expect(store.readBytes("missing/file.txt")).toBeNull();
    expect(store.exists("missing/file.txt")).toBe(false);
  });

  test("encryptAtRest without data key throws", () => {
    tenantRoot = mkdtempSync(join(tmpdir(), "ndb-vault-nokey-"));
    const store = new VaultStore({
      tenantRoot,
      encryptAtRest: true,
      dataKey: null,
    });

    expect(() => store.writeBytes("file.txt", Buffer.from("x"))).toThrow(
      "statements.store.invalid.key-required"
    );
  });
});
