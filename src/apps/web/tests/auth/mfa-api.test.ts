import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { API, apiPath } from "@ndb/platform";
import * as client from "@web/utils/api/client";
import {
  deleteWebAuthnCredential,
  listWebAuthnCredentials,
  mfaVerify,
  parseOtpauthSecret,
  recoveryClear,
  recoveryGenerate,
  totpBegin,
  totpConfirm,
  totpDisable,
  type WebAuthnLoginFinishPayload,
  type WebAuthnRegisterFinishPayload,
  webauthnLoginBegin,
  webauthnLoginFinish,
  webauthnRegisterBegin,
  webauthnRegisterFinish,
} from "@web/utils/api/routes/auth/mfa";

const tokenPair = {
  sessionToken: "access",
  refreshToken: "refresh",
  expiresIn: 900,
};

describe("MFA API client", () => {
  afterEach(() => {
    mock.restore();
  });

  test("totpBegin posts to the begin endpoint with bearer token", async () => {
    const apiRequest = spyOn(client, "apiRequest").mockResolvedValue({
      data: { uri: "otpauth://totp/test" },
    });

    const result = await totpBegin("bearer-token");

    expect(apiRequest).toHaveBeenCalledWith(
      API.users.me.totp.begin,
      expect.objectContaining({
        method: "POST",
        sessionToken: "bearer-token",
      })
    );
    expect(result).toEqual({ uri: "otpauth://totp/test" });
  });

  test("totpBegin posts proof body when MFA proof is provided", async () => {
    const apiRequest = spyOn(client, "apiRequest").mockResolvedValue({
      data: { uri: "otpauth://totp/test" },
    });

    await totpBegin("bearer-token", { totp: "123456" });

    expect(apiRequest).toHaveBeenCalledWith(
      API.users.me.totp.begin,
      expect.objectContaining({
        method: "POST",
        sessionToken: "bearer-token",
        body: { totp: "123456" },
      })
    );
  });

  test("totpBegin forwards abort signal when provided", async () => {
    const apiRequest = spyOn(client, "apiRequest").mockResolvedValue({
      data: { uri: "otpauth://totp/test" },
    });
    const controller = new AbortController();

    await totpBegin("bearer-token", undefined, controller.signal);

    expect(apiRequest).toHaveBeenCalledWith(
      API.users.me.totp.begin,
      expect.objectContaining({
        sessionToken: "bearer-token",
        signal: controller.signal,
      })
    );
  });

  test("totpConfirm posts code to the confirm endpoint", async () => {
    const apiRequest = spyOn(client, "apiRequest").mockResolvedValue({
      data: tokenPair,
    });

    await totpConfirm("bearer-token", "123456");

    expect(apiRequest).toHaveBeenCalledWith(
      API.users.me.totp.confirm,
      expect.objectContaining({
        method: "POST",
        sessionToken: "bearer-token",
        body: { code: "123456" },
      })
    );
  });

  test("mfaVerify posts totp to the verify endpoint and returns tokens", async () => {
    spyOn(client, "apiRequest").mockResolvedValue({
      data: tokenPair,
    });

    const result = await mfaVerify("bearer-token", { totp: "123456" });

    expect(client.apiRequest).toHaveBeenCalledWith(
      API.auth.session.multifactor.otp,
      expect.objectContaining({
        method: "POST",
        sessionToken: "bearer-token",
        body: { totp: "123456" },
      })
    );
    expect(result).toEqual(tokenPair);
  });

  test("mfaVerify posts recoveryCode to the verify endpoint", async () => {
    spyOn(client, "apiRequest").mockResolvedValue({
      data: tokenPair,
    });

    const result = await mfaVerify("bearer-token", {
      recoveryCode: "abcd-efgh",
    });

    expect(client.apiRequest).toHaveBeenCalledWith(
      API.auth.session.multifactor.otp,
      expect.objectContaining({
        body: { recoveryCode: "abcd-efgh" },
      })
    );
    expect(result).toEqual(tokenPair);
  });

  test("webauthnLoginBegin posts to login begin endpoint", async () => {
    spyOn(client, "apiRequest").mockResolvedValue({
      data: {
        sessionId: "session-1",
        options: { challenge: "abc" },
      },
    });

    const result = await webauthnLoginBegin("bearer-token");

    expect(client.apiRequest).toHaveBeenCalledWith(
      API.auth.session.multifactor.webauthn.begin,
      expect.objectContaining({
        method: "POST",
        sessionToken: "bearer-token",
      })
    );
    expect(result.sessionId).toBe("session-1");
  });

  test("webauthnLoginFinish posts finish payload and returns tokens", async () => {
    spyOn(client, "apiRequest").mockResolvedValue({
      data: tokenPair,
    });

    const payload: WebAuthnLoginFinishPayload = {
      sessionId: "session-1",
      response: {
        id: "cred-id",
        rawId: "cred-id",
        type: "public-key",
        response: {
          authenticatorData: "auth-data",
          clientDataJSON: "json",
          signature: "sig",
        },
        clientExtensionResults: {},
      },
    };

    const result = await webauthnLoginFinish("bearer-token", payload);

    expect(client.apiRequest).toHaveBeenCalledWith(
      API.auth.session.multifactor.webauthn.finish,
      expect.objectContaining({
        method: "POST",
        sessionToken: "bearer-token",
        body: payload,
      })
    );
    expect(result).toEqual(tokenPair);
  });

  test("totpBegin posts password body when provided", async () => {
    const apiRequest = spyOn(client, "apiRequest").mockResolvedValue({
      data: { uri: "otpauth://totp/test" },
    });

    await totpBegin("bearer-token", { password: "secret123" });

    expect(apiRequest).toHaveBeenCalledWith(
      API.users.me.totp.begin,
      expect.objectContaining({
        body: { password: "secret123" },
      })
    );
  });

  test("webauthnRegisterBegin posts to register begin endpoint", async () => {
    spyOn(client, "apiRequest").mockResolvedValue({
      data: {
        sessionId: "session-1",
        options: { challenge: "abc" },
      },
    });

    const result = await webauthnRegisterBegin("bearer-token");

    expect(client.apiRequest).toHaveBeenCalledWith(
      API.users.me.webauthn.create.begin,
      expect.objectContaining({
        method: "POST",
        sessionToken: "bearer-token",
      })
    );
    expect(result.sessionId).toBe("session-1");
  });

  test("webauthnRegisterBegin posts password body when provided", async () => {
    spyOn(client, "apiRequest").mockResolvedValue({
      data: {
        sessionId: "session-1",
        options: { challenge: "abc" },
      },
    });

    await webauthnRegisterBegin("bearer-token", { password: "secret123" });

    expect(client.apiRequest).toHaveBeenCalledWith(
      API.users.me.webauthn.create.begin,
      expect.objectContaining({
        body: { password: "secret123" },
      })
    );
  });

  test("webauthnRegisterBegin posts MFA proof when provided", async () => {
    spyOn(client, "apiRequest").mockResolvedValue({
      data: {
        sessionId: "session-1",
        options: { challenge: "abc" },
      },
    });

    await webauthnRegisterBegin("bearer-token", { totp: "123456" });

    expect(client.apiRequest).toHaveBeenCalledWith(
      API.users.me.webauthn.create.begin,
      expect.objectContaining({
        body: { totp: "123456" },
      })
    );
  });

  test("webauthnRegisterFinish posts finish payload", async () => {
    spyOn(client, "apiRequest").mockResolvedValue({
      data: tokenPair,
    });

    const payload: WebAuthnRegisterFinishPayload = {
      sessionId: "session-1",
      response: {
        id: "cred-id",
        rawId: "cred-id",
        type: "public-key",
        response: {
          attestationObject: "obj",
          clientDataJSON: "json",
        },
        clientExtensionResults: {},
      },
      name: "Laptop",
      totp: "123456",
    };

    await webauthnRegisterFinish("bearer-token", payload);

    expect(client.apiRequest).toHaveBeenCalledWith(
      API.users.me.webauthn.create.finish,
      expect.objectContaining({
        method: "POST",
        body: payload,
      })
    );
  });

  test("listWebAuthnCredentials fetches registered passkeys", async () => {
    spyOn(client, "apiRequest").mockResolvedValue({
      items: [{ id: "cred-1", name: "Laptop", createdAt: "2026-01-15T00:00:00Z" }],
      total: 1,
    });

    const result = await listWebAuthnCredentials("bearer-token");

    expect(client.apiRequest).toHaveBeenCalledWith(
      API.users.me.webauthn.list,
      expect.objectContaining({
        sessionToken: "bearer-token",
      })
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.name).toBe("Laptop");
  });

  test("parseOtpauthSecret extracts secret from a valid otpauth URI", () => {
    const uri = "otpauth://totp/NetworthDB:alice?secret=JBSWY3DPEHPK3PXP&issuer=NetworthDB";
    expect(parseOtpauthSecret(uri)).toBe("JBSWY3DPEHPK3PXP");
  });

  test("parseOtpauthSecret returns null for invalid URIs", () => {
    expect(parseOtpauthSecret("https://example.com")).toBeNull();
    expect(parseOtpauthSecret("otpauth://totp/user")).toBeNull();
    expect(parseOtpauthSecret("not-a-uri")).toBeNull();
  });

  test("totpDisable deletes TOTP with MFA proof", async () => {
    const apiRequest = spyOn(client, "apiRequest").mockResolvedValue(undefined);

    await totpDisable("bearer-token", { totp: "123456" });

    expect(apiRequest).toHaveBeenCalledWith(
      API.users.me.totp.disable,
      expect.objectContaining({
        method: "DELETE",
        sessionToken: "bearer-token",
        body: { totp: "123456" },
      })
    );
  });

  test("deleteWebAuthnCredential deletes passkey with MFA proof", async () => {
    const apiRequest = spyOn(client, "apiRequest").mockResolvedValue(undefined);

    await deleteWebAuthnCredential("bearer-token", "cred-1", {
      totp: "123456",
    });

    expect(apiRequest).toHaveBeenCalledWith(
      apiPath(API.users.me.webauthn.delete, { credentialId: "cred-1" }),
      expect.objectContaining({
        method: "DELETE",
        body: { totp: "123456" },
      })
    );
  });

  test("recoveryClear deletes recovery codes with MFA proof", async () => {
    const apiRequest = spyOn(client, "apiRequest").mockResolvedValue(undefined);

    await recoveryClear("bearer-token", { totp: "123456" });

    expect(apiRequest).toHaveBeenCalledWith(
      API.users.me.codes,
      expect.objectContaining({
        method: "DELETE",
        body: { totp: "123456" },
      })
    );
  });

  test("recoveryGenerate posts MFA proof to the generate endpoint", async () => {
    spyOn(client, "apiRequest").mockResolvedValue({
      data: {
        recoveryCodes: ["abcd-efgh", "ijkl-mnop"],
      },
    });

    const result = await recoveryGenerate("bearer-token", {
      totp: "123456",
    });

    expect(client.apiRequest).toHaveBeenCalledWith(
      API.users.me.codes,
      expect.objectContaining({
        method: "POST",
        body: { totp: "123456" },
      })
    );
    expect(result.recoveryCodes).toEqual(["abcd-efgh", "ijkl-mnop"]);
  });
});
