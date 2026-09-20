import {
  API,
  apiPath,
  jobCreatedSchema,
  ruleListSchema,
  ruleSchema,
  testRuleSchema,
} from "@ndb/platform";
import { apiRequest } from "@web/utils/api/client";
import { withSessionToken } from "@web/utils/api/routes/auth";
import type { JobCreatedResponse } from "@web/utils/api/routes/jobs/types";
import type {
  ApplyRulesBody,
  CreateRuleBody,
  PatchRuleBody,
  RuleApi,
  TestRuleBody,
  TestRuleResponse,
} from "@web/utils/api/routes/rules/types";

export async function fetchRules(params: {
  groupId: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: RuleApi[]; total: number }> {
  return withSessionToken((sessionToken) =>
    apiRequest(API.rules.list, {
      sessionToken,
      params: {
        groupId: params.groupId,
        limit: params.limit,
        offset: params.offset,
      },
      schema: ruleListSchema,
    })
  );
}

export async function fetchRule(ruleId: string): Promise<RuleApi> {
  const response = await withSessionToken((sessionToken) =>
    apiRequest(apiPath(API.rules.get, { ruleId }), {
      sessionToken,
      schema: ruleSchema,
    })
  );
  return response.data;
}

export async function createRule(body: CreateRuleBody): Promise<RuleApi> {
  const response = await withSessionToken((sessionToken) =>
    apiRequest(API.rules.create, {
      method: "POST",
      sessionToken,
      body,
      schema: ruleSchema,
    })
  );
  return response.data;
}

export async function patchRule(ruleId: string, body: PatchRuleBody): Promise<RuleApi> {
  const response = await withSessionToken((sessionToken) =>
    apiRequest(apiPath(API.rules.patch, { ruleId }), {
      method: "PATCH",
      sessionToken,
      body,
      schema: ruleSchema,
    })
  );
  return response.data;
}

export async function deleteRule(ruleId: string): Promise<void> {
  await withSessionToken((sessionToken) =>
    apiRequest(apiPath(API.rules.delete, { ruleId }), { method: "DELETE", sessionToken })
  );
}

export async function applyRule(
  ruleId: string,
  body: ApplyRulesBody = { dryRun: false }
): Promise<JobCreatedResponse> {
  const response = await withSessionToken((sessionToken) =>
    apiRequest(apiPath(API.rules.apply, { ruleId }), {
      method: "POST",
      sessionToken,
      body,
      schema: jobCreatedSchema,
    })
  );
  return response.data;
}

export async function testRule(ruleId: string, body: TestRuleBody): Promise<TestRuleResponse> {
  const response = await withSessionToken((sessionToken) =>
    apiRequest(apiPath(API.rules.test, { ruleId }), {
      method: "POST",
      sessionToken,
      body,
      schema: testRuleSchema,
    })
  );
  return response.data;
}
