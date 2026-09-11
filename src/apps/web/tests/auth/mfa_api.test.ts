import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { API } from "@ndb/platform";
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
} from "@web/utils/api/endpoints/auth/mfa";
import { apiPath } from "@web/utils/api/path";

const tokenPair = {
  session_token: "access",
  refresh_token: "refresh",
  expires_in: 900,
};

describe("MFA API client", () => {
  afterEach(() => {
    mock.restore();
  });

  test("totpBegin posts to the begin endpoint with bearer token", async () => {
    const post = spyOn(client, "post").mockResolvedValue({
      data: { uri: "otpauth://totp/test" },
      errors: [],
    });

    const result = await totpBegin("bearer-token");

    expect(post).toHaveBeenCalledWith(API.users.me.totp.begin, undefined, {
      sessionToken: "bearer-token",
    });
    expect(result).toEqual({ uri: "otpauth://totp/test" });
  });

  test("totpBegin posts proof body when MFA proof is provided", async () => {
    const post = spyOn(client, "post").mockResolvedValue({
      data: { uri: "otpauth://totp/test" },
      errors: [],
    });

    await totpBegin("bearer-token", { totp: "123456" });

    expect(post).toHaveBeenCalledWith(
      API.users.me.totp.begin,
      { totp: "123456" },
      { sessionToken: "bearer-token" }
    );
  });

  test("totpBegin forwards abort signal when provided", async () => {
    const post = spyOn(client, "post").mockResolvedValue({
      data: { uri: "otpauth://totp/test" },
      errors: [],
    });
    const controller = new AbortController();

    await totpBegin("bearer-token", undefined, controller.signal);

    expect(post).toHaveBeenCalledWith(API.users.me.totp.begin, undefined, {
      sessionToken: "bearer-token",
      signal: controller.signal,
    });
  });

  test("totpConfirm posts code to the confirm endpoint", async () => {
    const post = spyOn(client, "post").mockResolvedValue({
      data: null,
      errors: [],
    });

    await totpConfirm("bearer-token", "123456");

    expect(post).toHaveBeenCalledWith(
      API.users.me.totp.confirm,
      { code: "123456" },
      { sessionToken: "bearer-token" }
    );
  });

  test("mfaVerify posts totp to the verify endpoint and returns tokens", async () => {
    spyOn(client, "post").mockResolvedValue({
      data: tokenPair,
      errors: [],
    });

    const result = await mfaVerify("bearer-token", { totp: "123456" });

    expect(client.post).toHaveBeenCalledWith(
      API.auth.session.multifactor.otp,
      { totp: "123456" },
      { sessionToken: "bearer-token" }
    );
    expect(result).toEqual(tokenPair);
  });

  test("mfaVerify posts recovery_code to the verify endpoint", async () => {
    spyOn(client, "post").mockResolvedValue({
      data: tokenPair,
      errors: [],
    });

    const result = await mfaVerify("bearer-token", {
      recovery_code: "abcd-efgh",
    });

    expect(client.post).toHaveBeenCalledWith(
      API.auth.session.multifactor.otp,
      { recovery_code: "abcd-efgh" },
      { sessionToken: "bearer-token" }
    );
    expect(result).toEqual(tokenPair);
  });

  test("webauthnLoginBegin posts to login begin endpoint", async () => {
    spyOn(client, "post").mockResolvedValue({
      data: {
        session_id: "session-1",
        options: { challenge: "abc" },
      },
      errors: [],
    });

    const result = await webauthnLoginBegin("bearer-token");

    expect(client.post).toHaveBeenCalledWith(
      API.auth.session.multifactor.webauthn.begin,
      undefined,
      { sessionToken: "bearer-token" }
    );
    expect(result.session_id).toBe("session-1");
  });

  test("webauthnLoginFinish posts finish payload and returns tokens", async () => {
    spyOn(client, "post").mockResolvedValue({
      data: tokenPair,
      errors: [],
    });

    const payload: WebAuthnLoginFinishPayload = {
      session_id: "session-1",
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

    expect(client.post).toHaveBeenCalledWith(
      API.auth.session.multifactor.webauthn.finish,
      payload,
      { sessionToken: "bearer-token" }
    );
    expect(result).toEqual(tokenPair);
  });

  test("totpBegin posts password body when provided", async () => {
    const post = spyOn(client, "post").mockResolvedValue({
      data: { uri: "otpauth://totp/test" },
      errors: [],
    });

    await totpBegin("bearer-token", { password: "secret123" });

    expect(post).toHaveBeenCalledWith(
      API.users.me.totp.begin,
      { password: "secret123" },
      { sessionToken: "bearer-token" }
    );
  });

  test("webauthnRegisterBegin posts to register begin endpoint", async () => {
    spyOn(client, "post").mockResolvedValue({
      data: {
        session_id: "session-1",
        options: { challenge: "abc" },
      },
      errors: [],
    });

    const result = await webauthnRegisterBegin("bearer-token");

    expect(client.post).toHaveBeenCalledWith(API.users.me.webauthn.create.begin, undefined, {
      sessionToken: "bearer-token",
    });
    expect(result.session_id).toBe("session-1");
  });

  test("webauthnRegisterBegin posts password body when provided", async () => {
    spyOn(client, "post").mockResolvedValue({
      data: {
        session_id: "session-1",
        options: { challenge: "abc" },
      },
      errors: [],
    });

    await webauthnRegisterBegin("bearer-token", { password: "secret123" });

    expect(client.post).toHaveBeenCalledWith(
      API.users.me.webauthn.create.begin,
      { password: "secret123" },
      { sessionToken: "bearer-token" }
    );
  });

  test("webauthnRegisterBegin posts MFA proof when provided", async () => {
    spyOn(client, "post").mockResolvedValue({
      data: {
        session_id: "session-1",
        options: { challenge: "abc" },
      },
      errors: [],
    });

    await webauthnRegisterBegin("bearer-token", { totp: "123456" });

    expect(client.post).toHaveBeenCalledWith(
      API.users.me.webauthn.create.begin,
      { totp: "123456" },
      { sessionToken: "bearer-token" }
    );
  });

  test("webauthnRegisterFinish posts finish payload", async () => {
    spyOn(client, "post").mockResolvedValue({
      data: null,
      errors: [],
    });

    const payload: WebAuthnRegisterFinishPayload = {
      session_id: "session-1",
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

    expect(client.post).toHaveBeenCalledWith(API.users.me.webauthn.create.finish, payload, {
      sessionToken: "bearer-token",
    });
  });

  test("listWebAuthnCredentials fetches registered passkeys", async () => {
    spyOn(client, "get").mockResolvedValue({
      data: {
        items: [{ id: "cred-1", name: "Laptop", created_at: "2026-01-15T00:00:00Z" }],
        total: 1,
      },
      errors: [],
    });

    const result = await listWebAuthnCredentials("bearer-token");

    expect(client.get).toHaveBeenCalledWith(API.users.me.webauthn.list, {
      sessionToken: "bearer-token",
    });
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
    const del = spyOn(client, "del").mockResolvedValue({
      data: null,
      errors: [],
    });

    await totpDisable("bearer-token", { totp: "123456" });

    expect(del).toHaveBeenCalledWith(API.users.me.totp.disable, {
      body: { totp: "123456" },
      sessionToken: "bearer-token",
    });
  });

  test("deleteWebAuthnCredential deletes passkey with MFA proof", async () => {
    const del = spyOn(client, "del").mockResolvedValue({
      data: null,
      errors: [],
    });

    await deleteWebAuthnCredential("bearer-token", "cred-1", {
      totp: "123456",
    });

    expect(del).toHaveBeenCalledWith(apiPath(API.users.me.webauthn.details, { id: "cred-1" }), {
      body: { totp: "123456" },
      sessionToken: "bearer-token",
    });
  });

  test("recoveryClear deletes recovery codes with MFA proof", async () => {
    const del = spyOn(client, "del").mockResolvedValue({
      data: null,
      errors: [],
    });

    await recoveryClear("bearer-token", { totp: "123456" });

    expect(del).toHaveBeenCalledWith(API.users.me.codes, {
      body: { totp: "123456" },
      sessionToken: "bearer-token",
    });
  });

  test("recoveryGenerate posts MFA proof to the generate endpoint", async () => {
    spyOn(client, "post").mockResolvedValue({
      data: {
        recovery_codes: ["abcd-efgh", "ijkl-mnop"],
      },
      errors: [],
    });

    const result = await recoveryGenerate("bearer-token", {
      totp: "123456",
    });

    expect(client.post).toHaveBeenCalledWith(
      API.users.me.codes,
      { totp: "123456" },
      { sessionToken: "bearer-token" }
    );
    expect(result.recovery_codes).toEqual(["abcd-efgh", "ijkl-mnop"]);
  });
});
