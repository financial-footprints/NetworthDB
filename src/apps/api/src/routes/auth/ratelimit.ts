import type { AuthEnv } from "@api/config/hono-env";
import { jsonBody, jsonMedia } from "@api/config/http";
import { ApiRouter, errorResponses } from "@api/config/router";
import { withRateLimit } from "@api/routes/auth/helpers";
import {
  serializeAdvancedContext,
  serializeMessage,
  serializeMfaChallenge,
  serializeSessionTokens,
  serializeWebauthnSession,
} from "@api/routes/auth/serializer";
import type { MultifactorProofInput } from "@ndb/core";
import { isSessionTokenPair, ValidationError } from "@ndb/core";
import {
  API,
  advCompleteReqSchema,
  advCompleteSchema,
  advCtxSchema,
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

function buildMultifactorProof(body: {
  password?: string;
  totp?: string;
  recoveryCode?: string;
  webauthnSessionId?: string;
  webauthnResponse?: Record<string, unknown>;
}): MultifactorProofInput {
  return {
    password: body.password,
    totp: body.totp,
    recoveryCode: body.recoveryCode,
    webauthnSessionId: body.webauthnSessionId,
    webauthnResponse: body.webauthnResponse,
  };
}

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
      const result = await c.get("services").authService.login(username, password);

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
      const { refreshToken } = c.req.valid("json");
      const token = refreshToken?.trim() ?? "";
      if (token.length === 0) {
        throw new ValidationError("Refresh token is required.");
      }
      const pair = await c.get("services").authService.refresh(token);
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
      const result = await c
        .get("services")
        .authService.recovery.beginReset(username ?? "", email ?? "");
      return c.json(serializeMessage(result.message), 200);
    }
  )
  .endpoint(
    {
      method: "post",
      path: API.auth.recovery.password.complete,
      request: { body: jsonBody(pwResetCompleteReqSchema) },
      responses: {
        204: { description: "Password reset complete" },
        400: errorResponses[400],
        429: errorResponses[429],
      },
    },
    async (c) => {
      const body = c.req.valid("json");
      const token = body.token?.trim() ?? "";
      const newPassword = body.newPassword ?? "";
      if (token.length === 0 || newPassword.length === 0) {
        throw new ValidationError("Required fields are missing.");
      }
      await c.get("services").authService.recovery.completeReset({
        token,
        newPassword,
        multifactorProof: buildMultifactorProof(body),
      });
      return c.body(null, 204);
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
      const tokenPlain = token.trim();
      if (tokenPlain.length === 0) {
        throw new ValidationError("Token is required.");
      }
      const result = await c.get("services").authService.recovery.beginResetWebAuthn(tokenPlain);
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
      const result = await c
        .get("services")
        .authService.recovery.beginAdvanced(username ?? "", email ?? "");
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
      const tokenPlain = token?.trim() ?? "";
      if (tokenPlain.length === 0) {
        throw new ValidationError("Token is required.");
      }
      const context = await c.get("services").authService.recovery.getContext(tokenPlain);
      return c.json(serializeAdvancedContext(context), 200);
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
      const tokenPlain = token?.trim() ?? "";
      if (tokenPlain.length === 0) {
        throw new ValidationError("Token is required.");
      }
      const result = await c.get("services").authService.recovery.beginAdvancedWebAuthn(tokenPlain);
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
          description: "Advanced recovery MFA enrollment required",
        },
        204: { description: "Advanced recovery complete" },
        400: errorResponses[400],
        429: errorResponses[429],
      },
    },
    async (c) => {
      const body = c.req.valid("json");
      const token = body.token?.trim() ?? "";
      const newPassword = body.newPassword ?? "";
      if (token.length === 0 || newPassword.length === 0) {
        throw new ValidationError("Required fields are missing.");
      }
      const enrollment = await c.get("services").authService.recovery.completeAdvanced({
        token,
        newPassword,
        passwordSlot: body.passwordSlot,
        webauthnSessionId: body.webauthnSessionId,
        webauthnResponse: body.webauthnResponse,
      });

      if (enrollment) {
        return c.json(serializeMfaChallenge(enrollment), 200);
      }

      return c.body(null, 204);
    }
  );

export default rateLimitedRoutes;
