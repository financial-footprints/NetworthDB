import type { AuthEnv } from "@api/config/hono-env";
import { ApiRouter, errorResponses } from "@api/config/router";
import { jsonBody, jsonMedia, optionalJsonBody } from "@api/routes/auth/helpers";
import {
  serializeSessionTokens,
  serializeTotpBegin,
  serializeWebauthnSession,
} from "@api/routes/auth/serializer";
import { mfaPrincipal, requireMultifactor, requireSession } from "@ndb/middleware";
import {
  API,
  mfaProofReqSchema,
  sessionTokenSchema,
  totpBeginSchema,
  totpConfirmReqSchema,
  webauthnFinishReqSchema,
  webauthnSessionSchema,
} from "@ndb/platform";

const enrollmentRoutes = new ApiRouter<AuthEnv>();
enrollmentRoutes.applyRouteMiddleware(requireSession<AuthEnv>());
enrollmentRoutes.applyRouteMiddleware(requireMultifactor<AuthEnv>());

enrollmentRoutes
  .endpoint(
    {
      method: "post",
      path: API.users.me.totp.begin,
      request: { body: optionalJsonBody(mfaProofReqSchema) },
      responses: {
        200: { content: jsonMedia(totpBeginSchema), description: "TOTP enrollment begin" },
        400: errorResponses[400],
        401: errorResponses[401],
      },
    },
    async (c) => {
      const input = c.req.valid("json");
      const { multifactor } = mfaPrincipal(c.get("principal"));
      const result = await c.get("services").auth.multifactor.beginTotp(multifactor.bearer, input);
      return c.json(serializeTotpBegin(result.uri), 200);
    }
  )
  .endpoint(
    {
      method: "post",
      path: API.users.me.totp.confirm,
      request: { body: jsonBody(totpConfirmReqSchema) },
      responses: {
        200: { content: jsonMedia(sessionTokenSchema), description: "TOTP confirmed" },
        400: errorResponses[400],
        401: errorResponses[401],
      },
    },
    async (c) => {
      const { code } = c.req.valid("json");
      const { multifactor } = mfaPrincipal(c.get("principal"));
      const pair = await c.get("services").auth.multifactor.confirmTotp(multifactor.bearer, code);
      return c.json(serializeSessionTokens(pair), 200);
    }
  )
  .endpoint(
    {
      method: "post",
      path: API.users.me.webauthn.create.begin,
      request: { body: optionalJsonBody(mfaProofReqSchema) },
      responses: {
        200: {
          content: jsonMedia(webauthnSessionSchema),
          description: "WebAuthn register begin",
        },
        400: errorResponses[400],
        401: errorResponses[401],
      },
    },
    async (c) => {
      const input = c.req.valid("json");
      const { multifactor } = mfaPrincipal(c.get("principal"));
      const result = await c.get("services").auth.webauthn.registerBegin(multifactor.bearer, input);
      return c.json(serializeWebauthnSession(result.sessionId, result.options), 200);
    }
  )
  .endpoint(
    {
      method: "post",
      path: API.users.me.webauthn.create.finish,
      request: { body: jsonBody(webauthnFinishReqSchema) },
      responses: {
        200: {
          content: jsonMedia(sessionTokenSchema),
          description: "WebAuthn register finish",
        },
        400: errorResponses[400],
        401: errorResponses[401],
      },
    },
    async (c) => {
      const body = c.req.valid("json");
      const { multifactor } = mfaPrincipal(c.get("principal"));
      const pair = await c
        .get("services")
        .auth.webauthn.registerFinish(
          multifactor.bearer,
          body.sessionId,
          body.response as never,
          body.name
        );
      return c.json(serializeSessionTokens(pair), 200);
    }
  );

export default enrollmentRoutes;
