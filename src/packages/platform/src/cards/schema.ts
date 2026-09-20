import { requiredTrimmedString } from "@platform/schema/fields";
import { isoDateFieldSchema } from "@platform/schema/iso-date";
import { z } from "zod";

const isoDateSchema = isoDateFieldSchema("Date is invalid.");

export const SLOT_STATUSES = ["yes", "conditional", "depends", "unknown", "NA"] as const;
export const SLOT_CONFIDENCES = [
  "verified_mitc",
  "verified_product_page",
  "conflict",
  "unknown",
] as const;
export const SLOT_CONDITION_TYPES = [
  "spend",
  "cap",
  "channel",
  "merchant",
  "network",
  "txn_range",
  "other",
] as const;
export const DEFAULT_KINDS = [
  "sole_product",
  "parser_fallback",
  "unsupported_placeholder",
  "named",
] as const;
export const REWARD_KINDS = ["points", "cashback", "partner_wallet", "mixed", "unknown"] as const;

export const slotConditionSchema = z
  .object({
    type: z.enum(SLOT_CONDITION_TYPES),
    summary: requiredTrimmedString("Condition summary is required."),
  })
  .strict();

export const catalogSlotSchema = z
  .object({
    status: z.enum(SLOT_STATUSES),
    summary: requiredTrimmedString("Slot summary is required."),
    confidence: z.enum(SLOT_CONFIDENCES),
    conditions: z.array(slotConditionSchema).optional(),
    notes: requiredTrimmedString("Notes cannot be empty.").optional(),
  })
  .strict()
  .superRefine((slot, ctx) => {
    const naStatus = slot.status === "NA";
    const naSummary = slot.summary === "NA";
    if (naStatus !== naSummary) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'status "NA" requires summary "NA", and summary "NA" requires status "NA".',
      });
    }
  });

const feesGroupSchema = z
  .object({
    joining: catalogSlotSchema,
    annual: catalogSlotSchema,
    annual_waiver: catalogSlotSchema,
    forex: catalogSlotSchema,
    fuel_surcharge: catalogSlotSchema,
  })
  .strict();

const rewardsGroupSchema = z
  .object({
    base_earn: catalogSlotSchema,
    accelerated: catalogSlotSchema,
    upi: catalogSlotSchema,
    redemption: catalogSlotSchema,
    expiry: catalogSlotSchema,
  })
  .strict();

const loungeGroupSchema = z
  .object({
    summary: catalogSlotSchema,
    domestic: catalogSlotSchema,
    international: catalogSlotSchema,
    railway: catalogSlotSchema,
  })
  .strict();

const lifestyleGroupSchema = z
  .object({
    dining: catalogSlotSchema,
    movies: catalogSlotSchema,
    golf: catalogSlotSchema,
    concierge: catalogSlotSchema,
  })
  .strict();

const insuranceGroupSchema = z
  .object({
    travel: catalogSlotSchema,
    accident: catalogSlotSchema,
    card_protect: catalogSlotSchema,
  })
  .strict();

export const catalogSourceSchema = z
  .object({
    url: z.string().url("Source URL is invalid."),
    retrieved_at: isoDateSchema,
    label: requiredTrimmedString("Source label is required."),
  })
  .strict();

export const cardCatalogSchema = z
  .object({
    schema_version: z.literal(1),
    registry_key: requiredTrimmedString("Registry key is required."),
    bank: requiredTrimmedString("Bank is required."),
    variant: requiredTrimmedString("Variant is required."),
    display_name: requiredTrimmedString("Display name is required."),
    default_kind: z.enum(DEFAULT_KINDS),
    cobrand: requiredTrimmedString("Cobrand cannot be empty.").optional(),
    networks: z.array(requiredTrimmedString("Network cannot be empty.")),
    reward_kind: z.enum(REWARD_KINDS),
    official_product_url: z.string().url("Official product URL is invalid.").optional(),
    mitc_url: z.string().url("MITC URL is invalid.").optional(),
    researched_at: isoDateSchema,
    updated_at: isoDateSchema,
    sources: z.array(catalogSourceSchema).min(1, "At least one source is required."),
    tags: z.array(requiredTrimmedString("Tag cannot be empty.")),
    conflicts: z.array(requiredTrimmedString("Conflict cannot be empty.")),
    disclaimer: requiredTrimmedString("Disclaimer is required."),
    fees: feesGroupSchema,
    rewards: rewardsGroupSchema,
    lounge: loungeGroupSchema,
    lifestyle: lifestyleGroupSchema,
    insurance: insuranceGroupSchema,
    milestones: catalogSlotSchema,
    welcome: catalogSlotSchema,
  })
  .strict()
  .superRefine((catalog, ctx) => {
    const expectedKey = `${catalog.bank}/${catalog.variant}`;
    if (catalog.registry_key !== expectedKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `registry_key must equal "${expectedKey}".`,
        path: ["registry_key"],
      });
    }
  });

export type SlotStatus = (typeof SLOT_STATUSES)[number];
export type SlotConfidence = (typeof SLOT_CONFIDENCES)[number];
export type SlotConditionType = (typeof SLOT_CONDITION_TYPES)[number];
export type DefaultKind = (typeof DEFAULT_KINDS)[number];
export type RewardKind = (typeof REWARD_KINDS)[number];
export type CatalogSlot = z.infer<typeof catalogSlotSchema>;
export type CatalogSource = z.infer<typeof catalogSourceSchema>;
export type CardCatalog = z.infer<typeof cardCatalogSchema>;

export function parseCardCatalog(input: unknown): CardCatalog {
  return cardCatalogSchema.parse(input);
}
