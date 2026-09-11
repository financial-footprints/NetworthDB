import { createSessionRouter, errorResponses } from "@api/config/router";
import { jsonBody, jsonMedia, optionalJsonBody } from "@api/routes/auth/helpers";
import {
  serializeEmpty,
  serializeVaultSlot,
  serializeVaultSlots,
} from "@api/routes/auth/serializer";
import { sessionPrincipal } from "@ndb/middleware";
import {
  API,
  emptySchema,
  uuidIdParamsSchema,
  vaultAddSlotReqSchema,
  vaultInitReqSchema,
  vaultPasswordReqSchema,
  vaultSlotSchema,
  vaultSlotsSchema,
  vaultSlotUpdateReqSchema,
} from "@ndb/platform";

const vaultRoutes = createSessionRouter()
  .endpoint(
    {
      method: "post",
      path: API.users.me.vault.initialize,
      request: { body: jsonBody(vaultInitReqSchema) },
      responses: {
        201: { content: jsonMedia(vaultSlotsSchema), description: "Vault initialized" },
        400: errorResponses[400],
        401: errorResponses[401],
      },
    },
    async (c) => {
      const body = c.req.valid("json");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const slots = await c
        .get("services")
        .vault.initialize(user.id, auth.acr, body.slots, body.displayName);
      return c.json(serializeVaultSlots(slots), 201);
    }
  )
  .endpoint(
    {
      method: "post",
      path: API.users.me.vault.slots.list,
      request: { body: jsonBody(vaultAddSlotReqSchema) },
      responses: {
        201: { content: jsonMedia(vaultSlotSchema), description: "Vault slot added" },
        400: errorResponses[400],
        401: errorResponses[401],
      },
    },
    async (c) => {
      const slotInput = c.req.valid("json");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const slot = await c.get("services").vault.create(user.id, auth.acr, slotInput);
      return c.json(serializeVaultSlot(slot), 201);
    }
  )
  .endpoint(
    {
      method: "put",
      path: API.users.me.vault.slots.details,
      request: {
        params: uuidIdParamsSchema,
        body: jsonBody(vaultSlotUpdateReqSchema),
      },
      responses: {
        200: { content: jsonMedia(vaultSlotSchema), description: "Vault slot rotated" },
        400: errorResponses[400],
        401: errorResponses[401],
      },
    },
    async (c) => {
      const body = c.req.valid("json");
      const { id } = c.req.valid("param");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const slot = await c.get("services").vault.rotateWrap(user.id, auth.acr, id, body);
      return c.json(serializeVaultSlot(slot), 200);
    }
  )
  .endpoint(
    {
      method: "delete",
      path: API.users.me.vault.slots.details,
      request: {
        params: uuidIdParamsSchema,
        body: optionalJsonBody(vaultPasswordReqSchema),
      },
      responses: {
        200: { content: jsonMedia(emptySchema), description: "Vault slot deleted" },
        401: errorResponses[401],
      },
    },
    async (c) => {
      const password = c.req.valid("json");
      const { id } = c.req.valid("param");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      await c.get("services").vault.delete(user.id, auth.acr, id, password);
      return c.json(serializeEmpty(), 200);
    }
  );

export default vaultRoutes;
