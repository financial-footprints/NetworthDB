import { describe, expect, test } from "bun:test";
import { PublicUser } from "@core/domains/user/entities/public-user";
import { EntityNotFoundError, ValidationError } from "@core/shared/errors/domain-error";
import {
  createTestAuthServices,
  resetTotpStep,
  secretFromUri,
  totpCode,
} from "@tests/core/helpers/auth";
import { getById, getByUsername } from "@tests/core/helpers/helpers";

describe("WebAuthnService", () => {
  test("registerBegin rejects when WebAuthn is not configured", async () => {
    const services = await createTestAuthServices();
    const user = await getByUsername(services.users, "alice");

    await expect(
      services.auth.webauthn.registerBegin(
        { kind: "session", user, sessionId: user.id, authAcr: "aal1", authAmr: "pwd" },
        { password: "password123" }
      )
    ).rejects.toBeInstanceOf(ValidationError);
  });

  test("listCredentials returns an empty list", async () => {
    const services = await createTestAuthServices();
    const user = await getByUsername(services.users, "alice");
    const actor = PublicUser.fromUser(user);

    const result = await services.auth.webauthn.list(actor);

    expect(result.total).toBe(0);
    expect(result.items).toEqual([]);
  });

  test("deleteCredential rejects unknown credentials", async () => {
    const services = await createTestAuthServices();
    const user = await getByUsername(services.users, "alice");
    const begin = await services.auth.multifactor.beginTotp(
      { kind: "session", user, sessionId: user.id, authAcr: "aal1", authAmr: "pwd" },
      { password: "password123" }
    );
    const secret = secretFromUri(begin.uri);
    await services.auth.multifactor.confirmTotp(
      { kind: "session", user, sessionId: user.id, authAcr: "aal1", authAmr: "pwd" },
      totpCode(secret)
    );
    await resetTotpStep(services, "alice");

    const updatedUser = await getById(services.users, user.id);
    const actor = PublicUser.fromUser(updatedUser);

    await expect(
      services.auth.webauthn.delete(actor, crypto.randomUUID(), {
        totp: totpCode(secret),
      })
    ).rejects.toBeInstanceOf(EntityNotFoundError);
  });
});
