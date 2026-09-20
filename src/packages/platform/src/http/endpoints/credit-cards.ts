import { CATALOG_GROUPS } from "@platform/cards/groups";
import {
  cardCatalogSchema,
  DEFAULT_KINDS,
  REWARD_KINDS,
  SLOT_CONFIDENCES,
  SLOT_STATUSES,
  slotConditionSchema,
} from "@platform/cards/schema";
import { detailsResponseSchema, paginatedListResponseSchema } from "@platform/http/envelopes";
import { requiredTrimmedString } from "@platform/schema/fields";
import { z } from "zod";

export function catalogBenefitSlotIds(): string[] {
  const paths: string[] = [];
  for (const group of CATALOG_GROUPS) {
    if (group.kind === "slot") {
      paths.push(group.id);
      continue;
    }
    for (const field of group.fields) {
      paths.push(`${group.id}.${field.id}`);
    }
  }
  return paths;
}

export const creditCardCatalogListQuerySchema = z.object({
  tag: z.string().min(1).optional(),
});

export const creditCardCatalogParamsSchema = z.object({
  bank: z.string().min(1),
  variant: z.string().min(1),
});

export const creditCardBenefitSlotParamsSchema = z.object({
  slotId: z.string().min(1),
});

export const creditCardCatalogListItemSchema = z
  .object({
    registry_key: z.string(),
    display_name: z.string(),
    bank: z.string(),
    variant: z.string(),
    default_kind: z.enum(DEFAULT_KINDS),
    reward_kind: z.enum(REWARD_KINDS),
    tags: z.array(z.string()),
    official_product_url: z.string().url().optional(),
    mitc_url: z.string().url().optional(),
  })
  .strict();

export const creditCardCatalogListSchema = paginatedListResponseSchema(
  creditCardCatalogListItemSchema
);

export const creditCardCatalogDetailsSchema = detailsResponseSchema(cardCatalogSchema);

export const creditCardCatalogBulkDataSchema = z
  .object({
    items: z.array(cardCatalogSchema),
  })
  .strict();

export const creditCardCatalogBulkSchema = detailsResponseSchema(creditCardCatalogBulkDataSchema);

export const creditCardBenefitEntrySchema = z
  .object({
    registry_key: z.string(),
    display_name: z.string(),
    bank: z.string(),
    variant: z.string(),
    default_kind: z.enum(DEFAULT_KINDS),
    status: z.enum(SLOT_STATUSES),
    summary: requiredTrimmedString("Slot summary is required."),
    confidence: z.enum(SLOT_CONFIDENCES),
    conditions: z.array(slotConditionSchema).optional(),
    official_product_url: z.string().url().optional(),
    mitc_url: z.string().url().optional(),
  })
  .strict();

export const creditCardBenefitViewDataSchema = z
  .object({
    slot_id: z.string(),
    group_label: z.string(),
    field_label: z.string(),
    items: z.array(creditCardBenefitEntrySchema),
  })
  .strict();

export const creditCardBenefitSchema = detailsResponseSchema(creditCardBenefitViewDataSchema);

export type CreditCardCatalogListItem = z.infer<typeof creditCardCatalogListItemSchema>;
export type CreditCardBenefitView = z.infer<typeof creditCardBenefitViewDataSchema>;
