import { jsonBody, jsonMedia, optionalJsonBody } from "@api/config/http";
import { createSessionRouter, errorResponses } from "@api/config/router";
import { serializeVaultSlot, serializeVaultSlots } from "@api/routes/auth/serializer";
import type { VaultSlotInput } from "@ndb/core";
import { VAULT_SLOT_TYPES, ValidationError, type VaultSlotUpdateInput } from "@ndb/core";
import { sessionPrincipal } from "@ndb/middleware";
import {
  API,
  slotIdParamsSchema,
  vaultAddSlotReqSchema,
  vaultInitReqSchema,
  vaultPasswordReqSchema,
  type vaultSlotInputSchema,
  vaultSlotSchema,
  vaultSlotsSchema,
  vaultSlotUpdateReqSchema,
} from "@ndb/platform";
import type { z } from "zod";

type VaultInitBody = z.output<typeof vaultInitReqSchema>;
type ParsedVaultSlot = z.output<typeof vaultSlotInputSchema>;

function toVaultSlotInput(slot: ParsedVaultSlot): VaultSlotInput {
  const slotType = slot.slotType;
  const salt = slot.salt;
  const wrapBlob = slot.wrapBlob;
  if (!slotType || !salt || !wrapBlob) {
    throw new ValidationError("Vault slot fields are required.");
  }
  if (!VAULT_SLOT_TYPES.includes(slotType as (typeof VAULT_SLOT_TYPES)[number])) {
    throw new ValidationError("Vault slot type is invalid.", { field: "slotType" });
  }
  return {
    slotType: slotType as VaultSlotInput["slotType"],
    salt,
    wrapBlob,
    credentialId: slot.credentialId,
    label: slot.label,
    password: slot.password,
  };
}

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
      const body: VaultInitBody = vaultInitReqSchema.parse(c.req.valid("json"));
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const slots = body.slots.map(toVaultSlotInput);
      const created = await c
        .get("services")
        .vaultService.initialize(user.id, auth.acr, slots, body.displayName);
      return c.json(serializeVaultSlots(created), 201);
    }
  )
  .endpoint(
    {
      method: "post",
      path: API.users.me.vault.slots.create,
      request: { body: jsonBody(vaultAddSlotReqSchema) },
      responses: {
        201: { content: jsonMedia(vaultSlotSchema), description: "Vault slot added" },
        400: errorResponses[400],
        401: errorResponses[401],
        422: errorResponses[422],
      },
    },
    async (c) => {
      const slotInput = toVaultSlotInput(vaultAddSlotReqSchema.parse(c.req.valid("json")));
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const slot = await c.get("services").vaultService.create(user.id, auth.acr, slotInput);
      return c.json(serializeVaultSlot(slot), 201);
    }
  )
  .endpoint(
    {
      method: "patch",
      path: API.users.me.vault.slots.patch,
      request: {
        params: slotIdParamsSchema,
        body: jsonBody(vaultSlotUpdateReqSchema),
      },
      responses: {
        200: { content: jsonMedia(vaultSlotSchema), description: "Vault slot rotated" },
        400: errorResponses[400],
        401: errorResponses[401],
      },
    },
    async (c) => {
      const raw = c.req.valid("json");
      const { slotId } = c.req.valid("param");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const salt = raw.salt;
      const wrapBlob = raw.wrapBlob;
      if (!salt || !wrapBlob) {
        throw new ValidationError("Salt and wrap blob are required.", { field: "salt" });
      }
      const update: VaultSlotUpdateInput = {
        salt,
        wrapBlob,
        password: raw.password,
      };
      const slot = await c
        .get("services")
        .vaultService.rotateWrap(user.id, auth.acr, slotId, update);
      return c.json(serializeVaultSlot(slot), 200);
    }
  )
  .endpoint(
    {
      method: "delete",
      path: API.users.me.vault.slots.delete,
      request: {
        params: slotIdParamsSchema,
        body: optionalJsonBody(vaultPasswordReqSchema),
      },
      responses: {
        204: { description: "Vault slot deleted" },
        401: errorResponses[401],
        422: errorResponses[422],
      },
    },
    async (c) => {
      const body = c.req.valid("json");
      const { slotId } = c.req.valid("param");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const password = body?.password;
      await c.get("services").vaultService.delete(user.id, auth.acr, slotId, password);
      return c.body(null, 204);
    }
  );

export default vaultRoutes;
