import type { AuthEnv } from "@api/config/hono-env";
import { ApiRouter, errorResponses } from "@api/config/router";
import { jsonBody, jsonMedia, withRateLimit } from "@api/routes/auth/helpers";
import {
  serializeAdvCtx,
  serializeEmpty,
  serializeMessage,
  serializeMfaChallenge,
  serializeSessionTokens,
  serializeWebauthnSession,
} from "@api/routes/auth/serializer";
import { isSessionTokenPair } from "@ndb/core";
import {
  API,
  advCompleteReqSchema,
  advCompleteSchema,
  advCtxSchema,
  emptySchema,
  loginReqSchema,
  loginSchema,
  messageSchema,
  pwResetBeginReqSchema,
  pwResetCompleteReqSchema,
  recoveryTokenReqSchema,
  refreshReqSchema,
  sessionTokenSchema,
  webauthnSessionSchema,
} from "@ndb/platform";

const rateLimitedRoutes = new ApiRouter<AuthEnv>();
rateLimitedRoutes.applyRouteMiddleware(withRateLimit());

rateLimitedRoutes
  .endpoint(
    {
      method: "post",
      path: API.auth.session.login,
      request: { body: jsonBody(loginReqSchema) },
      responses: {
        200: {
          content: jsonMedia(loginSchema),
          description: "Login success or multifactor challenge",
        },
        400: errorResponses[400],
        401: errorResponses[401],
        429: errorResponses[429],
      },
    },
    async (c) => {
      const { username, password } = c.req.valid("json");
      const result = await c.get("services").auth.login(username, password);

      if (isSessionTokenPair(result)) {
        return c.json(serializeSessionTokens(result), 200);
      }

      return c.json(serializeMfaChallenge(result), 200);
    }
  )
  .endpoint(
    {
      method: "post",
      path: API.auth.session.refresh,
      request: { body: jsonBody(refreshReqSchema) },
      responses: {
        200: { content: jsonMedia(sessionTokenSchema), description: "Session refreshed" },
        400: errorResponses[400],
        401: errorResponses[401],
        429: errorResponses[429],
      },
    },
    async (c) => {
      const { refresh_token } = c.req.valid("json");
      const pair = await c.get("services").auth.refresh(refresh_token);
      return c.json(serializeSessionTokens(pair), 200);
    }
  )
  .endpoint(
    {
      method: "post",
      path: API.auth.recovery.password.begin,
      request: { body: jsonBody(pwResetBeginReqSchema) },
      responses: {
        200: { content: jsonMedia(messageSchema), description: "Password reset started" },
        400: errorResponses[400],
        429: errorResponses[429],
      },
    },
    async (c) => {
      const { username, email } = c.req.valid("json");
      const result = await c.get("services").auth.recovery.beginReset(username, email);
      return c.json(serializeMessage(result.message), 200);
    }
  )
  .endpoint(
    {
      method: "post",
      path: API.auth.recovery.password.complete,
      request: { body: jsonBody(pwResetCompleteReqSchema) },
      responses: {
        200: {
          content: jsonMedia(emptySchema),
          description: "Password reset complete",
        },
        400: errorResponses[400],
        429: errorResponses[429],
      },
    },
    async (c) => {
      const { token, newPassword, multifactorProof } = c.req.valid("json");
      await c.get("services").auth.recovery.completeReset({
        token,
        newPassword,
        multifactorProof,
      });
      return c.json(serializeEmpty(), 200);
    }
  )
  .endpoint(
    {
      method: "post",
      path: API.auth.recovery.password.webauthn,
      request: { body: jsonBody(recoveryTokenReqSchema) },
      responses: {
        200: {
          content: jsonMedia(webauthnSessionSchema),
          description: "WebAuthn recovery begin",
        },
        400: errorResponses[400],
        429: errorResponses[429],
      },
    },
    async (c) => {
      const { token } = c.req.valid("json");
      const result = await c.get("services").auth.recovery.beginResetWebAuthn(token);
      return c.json(serializeWebauthnSession(result.sessionId, result.options), 200);
    }
  )
  .endpoint(
    {
      method: "post",
      path: API.auth.recovery.advanced.begin,
      request: { body: jsonBody(pwResetBeginReqSchema) },
      responses: {
        200: {
          content: jsonMedia(messageSchema),
          description: "Advanced recovery started",
        },
        400: errorResponses[400],
        429: errorResponses[429],
      },
    },
    async (c) => {
      const { username, email } = c.req.valid("json");
      const result = await c.get("services").auth.recovery.beginAdvanced(username, email);
      return c.json(serializeMessage(result.message), 200);
    }
  )
  .endpoint(
    {
      method: "post",
      path: API.auth.recovery.advanced.context,
      request: { body: jsonBody(recoveryTokenReqSchema) },
      responses: {
        200: {
          content: jsonMedia(advCtxSchema),
          description: "Advanced recovery context",
        },
        400: errorResponses[400],
        429: errorResponses[429],
      },
    },
    async (c) => {
      const { token } = c.req.valid("json");
      const context = await c.get("services").auth.recovery.getContext(token);
      return c.json(serializeAdvCtx(context), 200);
    }
  )
  .endpoint(
    {
      method: "post",
      path: API.auth.recovery.advanced.webauthn,
      request: { body: jsonBody(recoveryTokenReqSchema) },
      responses: {
        200: {
          content: jsonMedia(webauthnSessionSchema),
          description: "Advanced recovery WebAuthn",
        },
        400: errorResponses[400],
        429: errorResponses[429],
      },
    },
    async (c) => {
      const { token } = c.req.valid("json");
      const result = await c.get("services").auth.recovery.beginAdvancedWebAuthn(token);
      return c.json(serializeWebauthnSession(result.sessionId, result.options), 200);
    }
  )
  .endpoint(
    {
      method: "post",
      path: API.auth.recovery.advanced.complete,
      request: { body: jsonBody(advCompleteReqSchema) },
      responses: {
        200: {
          content: jsonMedia(advCompleteSchema),
          description: "Advanced recovery complete",
        },
        400: errorResponses[400],
        429: errorResponses[429],
      },
    },
    async (c) => {
      const enrollment = await c
        .get("services")
        .auth.recovery.completeAdvanced(c.req.valid("json"));

      if (enrollment) {
        return c.json(serializeMfaChallenge(enrollment), 200);
      }

      return c.json(serializeEmpty(), 200);
    }
  );

export default rateLimitedRoutes;
