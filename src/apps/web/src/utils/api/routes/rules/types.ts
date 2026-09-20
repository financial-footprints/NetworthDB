import type {
  applyRulesReqSchema,
  catalogItemSchema,
  createRuleReqSchema,
  patchRuleReqSchema,
  ruleSchema,
  testRuleDataSchema,
  testRuleReqSchema,
} from "@ndb/platform";
import type { z } from "zod";

export type CatalogItem = z.infer<typeof catalogItemSchema>;

export type RuleApi = z.infer<typeof ruleSchema>["data"];

export type CreateRuleBody = z.infer<typeof createRuleReqSchema>;

export type PatchRuleBody = z.infer<typeof patchRuleReqSchema>;

export type ApplyRulesBody = z.input<typeof applyRulesReqSchema>;

export type TestRuleBody = z.infer<typeof testRuleReqSchema>;

export type TestRuleResponse = z.infer<typeof testRuleDataSchema>;
