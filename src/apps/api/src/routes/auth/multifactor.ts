import type { AuthEnv } from "@api/config/hono-env";
import { ApiRouter, errorResponses } from "@api/config/router";
import { jsonBody, jsonMedia, optionalJsonBody, withRateLimit } from "@api/routes/auth/helpers";
import { serializeSessionTokens, serializeWebauthnSession } from "@api/routes/auth/serializer";
import { mfaPrincipal, requireMultifactor, requireMultifactorChallenge } from "@ndb/middleware";
import {
  API,
  mfaProofReqSchema,
  mfaVerifyReqSchema,
  sessionTokenSchema,
  webauthnFinishReqSchema,
  webauthnSessionSchema,
} from "@ndb/platform";

export const mfaChallengeRoutes = new ApiRouter<AuthEnv>();
mfaChallengeRoutes.applyRouteMiddleware(withRateLimit());
mfaChallengeRoutes.applyRouteMiddleware(requireMultifactorChallenge<AuthEnv>());

mfaChallengeRoutes
  .endpoint(
    {
      method: "post",
      path: API.auth.session.multifactor.otp,
      request: { body: jsonBody(mfaVerifyReqSchema) },
      responses: {
        200: {
          content: jsonMedia(sessionTokenSchema),
          description: "Multifactor verified",
        },
        400: errorResponses[400],
        401: errorResponses[401],
        429: errorResponses[429],
      },
    },
    async (c) => {
      const { totp, recoveryCode } = c.req.valid("json");
      const { multifactor } = mfaPrincipal(c.get("principal"));
      const services = c.get("services").auth;

      if (totp !== undefined) {
        const pair = await services.multifactor.verifyTotp(multifactor.token, totp);
        return c.json(serializeSessionTokens(pair), 200);
      }

      if (recoveryCode === undefined) {
        throw new Error("unreachable: multifactor proof required");
      }

      const pair = await services.multifactor.verifyRecoveryCode(multifactor.token, recoveryCode);
      return c.json(serializeSessionTokens(pair), 200);
    }
  )
  .endpoint(
    {
      method: "post",
      path: API.auth.session.multifactor.webauthn.finish,
      request: { body: jsonBody(webauthnFinishReqSchema) },
      responses: {
        200: {
          content: jsonMedia(sessionTokenSchema),
          description: "WebAuthn login complete",
        },
        400: errorResponses[400],
        401: errorResponses[401],
        429: errorResponses[429],
      },
    },
    async (c) => {
      const body = c.req.valid("json");
      const { multifactor } = mfaPrincipal(c.get("principal"));
      const pair = await c
        .get("services")
        .auth.webauthn.loginFinish(multifactor.token, body.sessionId, body.response as never);
      return c.json(serializeSessionTokens(pair), 200);
    }
  );

export const mfaLoginBeginRoutes = new ApiRouter<AuthEnv>();
mfaLoginBeginRoutes.applyRouteMiddleware(withRateLimit());
mfaLoginBeginRoutes.applyRouteMiddleware(requireMultifactor<AuthEnv>());

mfaLoginBeginRoutes.endpoint(
  {
    method: "post",
    path: API.auth.session.multifactor.webauthn.begin,
    request: { body: optionalJsonBody(mfaProofReqSchema) },
    responses: {
      200: {
        content: jsonMedia(webauthnSessionSchema),
        description: "WebAuthn login begin",
      },
      400: errorResponses[400],
      401: errorResponses[401],
      429: errorResponses[429],
    },
  },
  async (c) => {
    const input = c.req.valid("json");
    const { multifactor } = mfaPrincipal(c.get("principal"));
    const result = await c.get("services").auth.webauthn.loginBegin(multifactor.bearer, input);
    return c.json(serializeWebauthnSession(result.sessionId, result.options), 200);
  }
);
