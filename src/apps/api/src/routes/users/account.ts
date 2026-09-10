import { createSessionRouter, errorResponses } from "@api/config/router";
import { jsonBody, jsonMedia } from "@api/routes/auth/helpers";
import { serializeEmpty, serializeSessionTokens } from "@api/routes/auth/serializer";
import { type SessionTokenPair, ValidationError } from "@ndb/core";
import { sessionPrincipal } from "@ndb/middleware";
import { API, patchMeReqSchema, patchMeSchema } from "@ndb/platform";

function requireCurrentPassword(password?: string): string {
  if (password === undefined) {
    throw new ValidationError("api.auth.account.password.invalid.current-required", {
      field: "current_password",
    });
  }

  return password;
}

const accountRoutes = createSessionRouter();

accountRoutes.endpoint(
  {
    method: "patch",
    path: API.users.me.update,
    request: { body: jsonBody(patchMeReqSchema) },
    responses: {
      200: {
        content: jsonMedia(patchMeSchema),
        description: "Account updated",
      },
      400: errorResponses[400],
      401: errorResponses[401],
    },
  },
  async (c) => {
    const body = c.req.valid("json");
    const { user: actor, jwt } = sessionPrincipal(c.get("principal"));
    const authAcr = jwt.acr;
    const authAmr = jwt.amr;
    let sessionPair: SessionTokenPair | undefined;

    if (body.e2eeName !== undefined) {
      await c.get("services").vault.update(actor.id, body.e2eeName);
    }

    if (body.username !== undefined) {
      const currentPassword = requireCurrentPassword(body.currentPassword);
      sessionPair = await c
        .get("services")
        .auth.updateUsername(actor, authAcr, authAmr, body.username, currentPassword);
    }

    if (body.newPassword !== undefined) {
      const currentPassword = requireCurrentPassword(body.currentPassword);
      sessionPair = await c
        .get("services")
        .auth.updatePassword(actor, authAcr, authAmr, currentPassword, body.newPassword);
    }

    if (body.recoveryEmail !== undefined) {
      const currentPassword = requireCurrentPassword(body.currentPassword);

      if (body.recoveryEmail === null) {
        await c.get("services").auth.recovery.deleteEmail(actor.id, currentPassword);
      } else {
        await c
          .get("services")
          .auth.recovery.updateEmail(actor.id, currentPassword, body.recoveryEmail);
      }
    }

    if (sessionPair) {
      return c.json(serializeSessionTokens(sessionPair), 200);
    }

    return c.json(serializeEmpty(), 200);
  }
);

export default accountRoutes;
