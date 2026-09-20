import type {
  createRuleGroupReqSchema,
  patchRuleGroupReqSchema,
  ruleGroupSchema,
} from "@ndb/platform";
import type { z } from "zod";

export type RuleGroupApi = z.infer<typeof ruleGroupSchema>["data"];

export type CreateRuleGroupBody = z.infer<typeof createRuleGroupReqSchema>;

export type PatchRuleGroupBody = z.infer<typeof patchRuleGroupReqSchema>;
