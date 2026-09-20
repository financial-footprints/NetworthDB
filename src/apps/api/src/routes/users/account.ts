import { jsonBody, jsonMedia } from "@api/config/http";
import { createSessionRouter, errorResponses } from "@api/config/router";
import {
  serializeNullableSessionResponse,
  serializeSessionTokens,
} from "@api/routes/auth/serializer";
import { type SessionTokenPair, ValidationError } from "@ndb/core";
import { sessionPrincipal } from "@ndb/middleware";
import { API, patchMeReqSchema, patchMeSchema } from "@ndb/platform";

function requireCurrentPassword(password?: string): string {
  if (password === undefined) {
    throw new ValidationError("Current password is required.", {
      field: "currentPassword",
    });
  }

  return password;
}

const accountRoutes = createSessionRouter();

accountRoutes.endpoint(
  {
    method: "patch",
    path: API.users.me.patch,
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
    const { user, auth } = sessionPrincipal(c.get("principal"));
    const authAcr = auth.acr;
    const authAmr = auth.amr;
    let sessionPair: SessionTokenPair | undefined;

    if (body.displayName !== undefined) {
      await c.get("services").userService.updateDisplayName(user.id, body.displayName);
    }

    if (body.clientSettings !== undefined) {
      await c.get("services").userService.saveClientSettings(user.id, body.clientSettings);
    }

    if (body.username !== undefined) {
      const currentPassword = requireCurrentPassword(body.currentPassword);
      sessionPair = await c
        .get("services")
        .authService.updateUsername(user, authAcr, authAmr, body.username, currentPassword);
    }

    if (body.newPassword !== undefined) {
      const currentPassword = requireCurrentPassword(body.currentPassword);
      sessionPair = await c
        .get("services")
        .authService.updatePassword(user, authAcr, authAmr, currentPassword, body.newPassword);
    }

    if (body.recoveryEmail !== undefined) {
      const currentPassword = requireCurrentPassword(body.currentPassword);

      if (body.recoveryEmail === null) {
        await c.get("services").authService.recovery.deleteEmail(user.id, currentPassword);
      } else {
        await c
          .get("services")
          .authService.recovery.updateEmail(user.id, currentPassword, body.recoveryEmail);
      }
    }

    if (sessionPair) {
      return c.json(serializeSessionTokens(sessionPair), 200);
    }

    return c.json(serializeNullableSessionResponse(), 200);
  }
);

export default accountRoutes;
