import { createSessionRouter, errorResponses } from "@api/config/router";
import { jsonBody, jsonMedia } from "@api/routes/auth/helpers";
import {
  serializeEmpty,
  serializeRecoveryCodes,
  serializeWebauthnCreds,
} from "@api/routes/auth/serializer";
import { sessionPrincipal } from "@ndb/middleware";
import {
  API,
  emptySchema,
  mfaProofReqSchema,
  recoveryCodeSchema,
  totpDisableReqSchema,
  uuidIdParamsSchema,
  webauthnCredSchema,
} from "@ndb/platform";

const multifactorRoutes = createSessionRouter()
  .endpoint(
    {
      method: "post",
      path: API.users.me.codes,
      request: { body: jsonBody(mfaProofReqSchema) },
      responses: {
        200: {
          content: jsonMedia(recoveryCodeSchema),
          description: "Backup codes generated",
        },
        400: errorResponses[400],
        401: errorResponses[401],
      },
    },
    async (c) => {
      const proof = c.req.valid("json");
      const codes = await c
        .get("services")
        .auth.multifactor.generateCodes(c.get("principal").user, proof);
      return c.json(serializeRecoveryCodes(codes), 200);
    }
  )
  .endpoint(
    {
      method: "delete",
      path: API.users.me.codes,
      request: { body: jsonBody(mfaProofReqSchema) },
      responses: {
        200: { content: jsonMedia(emptySchema), description: "Backup codes cleared" },
        401: errorResponses[401],
      },
    },
    async (c) => {
      const proof = c.req.valid("json");
      await c.get("services").auth.multifactor.clearCodes(c.get("principal").user, proof);
      return c.json(serializeEmpty(), 200);
    }
  )
  .endpoint(
    {
      method: "delete",
      path: API.users.me.totp.disable,
      request: { body: jsonBody(totpDisableReqSchema) },
      responses: {
        200: { content: jsonMedia(emptySchema), description: "TOTP disabled" },
        400: errorResponses[400],
        401: errorResponses[401],
      },
    },
    async (c) => {
      const { totp } = c.req.valid("json");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      await c.get("services").auth.multifactor.disableTotp(user, auth.acr, totp);
      return c.json(serializeEmpty(), 200);
    }
  )
  .endpoint(
    {
      method: "get",
      path: API.users.me.webauthn.list,
      responses: {
        200: {
          content: jsonMedia(webauthnCredSchema),
          description: "WebAuthn credentials",
        },
        401: errorResponses[401],
      },
    },
    async (c) => {
      const result = await c.get("services").auth.webauthn.list(c.get("principal").user);
      return c.json(serializeWebauthnCreds(result.items, result.total), 200);
    }
  )
  .endpoint(
    {
      method: "delete",
      path: API.users.me.webauthn.details,
      request: {
        params: uuidIdParamsSchema,
        body: jsonBody(mfaProofReqSchema),
      },
      responses: {
        200: { content: jsonMedia(emptySchema), description: "Credential deleted" },
        401: errorResponses[401],
      },
    },
    async (c) => {
      const proof = c.req.valid("json");
      const { id } = c.req.valid("param");
      await c.get("services").auth.webauthn.delete(c.get("principal").user, id, proof);
      return c.json(serializeEmpty(), 200);
    }
  );

export default multifactorRoutes;
