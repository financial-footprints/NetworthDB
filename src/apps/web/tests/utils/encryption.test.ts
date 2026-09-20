import { afterEach, describe, expect, spyOn, test } from "bun:test";
import * as authSession from "@web/contexts/Auth/user";
import { visibleEncryptionModules } from "@web/utils/crypto/types";

afterEach(() => {
  spyOn(authSession, "isTotpEnrolled").mockRestore();
});

function enabledModuleIds(): string[] {
  return visibleEncryptionModules().map(({ module }) => module.id);
}

describe("encryption modules", () => {
  test("exposes profile, accounts, transactions, and statements modules", () => {
    expect(enabledModuleIds()).toEqual([
      "profile",
      "accounts",
      "transactions",
      "rules",
      "statements",
    ]);
  });

  test("hides TOTP-only fields when not enrolled", () => {
    const isTotpEnrolled = spyOn(authSession, "isTotpEnrolled");

    isTotpEnrolled.mockReturnValue(false);
    const withoutTotp = visibleEncryptionModules();
    const profileWithoutTotp = withoutTotp.find(({ module }) => module.id === "profile");
    isTotpEnrolled.mockReturnValue(true);
    const withTotp = visibleEncryptionModules();
    const profileWithTotp = withTotp.find(({ module }) => module.id === "profile");

    expect(profileWithoutTotp?.fields.map((field) => field.label)).toEqual([
      "Your Name",
      "Username",
      "Recovery Email",
    ]);
    expect(profileWithTotp?.fields.map((field) => field.label)).toContain("Authenticator Secret");
  });

  test("visibleEncryptionModules exposes account metadata and secrets", () => {
    const modules = visibleEncryptionModules();
    const accountsModule = modules.find(({ module }) => module.id === "accounts");

    expect(accountsModule).toBeDefined();
    expect(accountsModule?.module.name).toBe("Accounts");
    expect(accountsModule?.fields.map((field) => field.label)).toEqual([
      "Account Metadata",
      "Account Number",
      "Account Secrets",
    ]);
    expect(accountsModule?.fields[0]?.kind).toBe("server_encrypted");
    expect(accountsModule?.fields[1]?.e2eeFieldId).toBe("account_number");
    expect(accountsModule?.fields[2]?.kind).toBe("server_encrypted");
  });

  test("statements module exposes statement files and source credentials", () => {
    const modules = visibleEncryptionModules();
    const statementsModule = modules.find(({ module }) => module.id === "statements");

    expect(statementsModule).toBeDefined();
    expect(statementsModule?.fields.map((field) => field.label)).toEqual([
      "Statement Files",
      "Source Credentials",
    ]);
  });

  test("statement files and account secrets are server encrypted with disclosure copy", () => {
    const modules = visibleEncryptionModules();
    const statementsModule = modules.find(({ module }) => module.id === "statements");
    const accountsModule = modules.find(({ module }) => module.id === "accounts");
    const statementFiles = statementsModule?.fields.find(
      (field) => field.label === "Statement Files"
    );
    const accountSecrets = accountsModule?.fields.find(
      (field) => field.label === "Account Secrets"
    );
    const sourceCredentials = statementsModule?.fields.find(
      (field) => field.label === "Source Credentials"
    );

    expect(statementFiles?.kind).toBe("server_encrypted");
    expect(statementFiles?.detail).toContain("Encrypted");
    expect(accountSecrets?.kind).toBe("server_encrypted");
    expect(accountSecrets?.detail).toContain("passwords");
    expect(sourceCredentials?.kind).toBe("server_encrypted");
  });
});
