import {
  API,
  apiPath,
  jobCreatedSchema,
  ruleGroupListSchema,
  ruleGroupSchema,
} from "@ndb/platform";
import { apiRequest } from "@web/utils/api/client";
import { withSessionToken } from "@web/utils/api/routes/auth";
import type { JobCreatedResponse } from "@web/utils/api/routes/jobs/types";
import type {
  CreateRuleGroupBody,
  PatchRuleGroupBody,
  RuleGroupApi,
} from "@web/utils/api/routes/rule-groups/types";
import type { ApplyRulesBody } from "@web/utils/api/routes/rules/types";

export async function fetchRuleGroups(params?: {
  limit?: number;
  offset?: number;
}): Promise<{ items: RuleGroupApi[]; total: number }> {
  return withSessionToken((sessionToken) =>
    apiRequest(API.ruleGroups.list, { sessionToken, params, schema: ruleGroupListSchema })
  );
}

export async function createRuleGroup(body: CreateRuleGroupBody): Promise<RuleGroupApi> {
  const response = await withSessionToken((sessionToken) =>
    apiRequest(API.ruleGroups.create, {
      method: "POST",
      sessionToken,
      body,
      schema: ruleGroupSchema,
    })
  );
  return response.data;
}

export async function patchRuleGroup(
  groupId: string,
  body: PatchRuleGroupBody
): Promise<RuleGroupApi> {
  const response = await withSessionToken((sessionToken) =>
    apiRequest(apiPath(API.ruleGroups.patch, { ruleGroupId: groupId }), {
      method: "PATCH",
      sessionToken,
      body,
      schema: ruleGroupSchema,
    })
  );
  return response.data;
}

export async function deleteRuleGroup(groupId: string): Promise<void> {
  await withSessionToken((sessionToken) =>
    apiRequest(apiPath(API.ruleGroups.delete, { ruleGroupId: groupId }), {
      method: "DELETE",
      sessionToken,
    })
  );
}

export async function applyRuleGroup(
  groupId: string,
  body: ApplyRulesBody = { dryRun: false }
): Promise<JobCreatedResponse> {
  const response = await withSessionToken((sessionToken) =>
    apiRequest(apiPath(API.ruleGroups.apply, { ruleGroupId: groupId }), {
      method: "POST",
      sessionToken,
      body,
      schema: jobCreatedSchema,
    })
  );
  return response.data;
}
