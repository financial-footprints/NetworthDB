import { jsonBody, jsonMedia } from "@api/config/http";
import { createSessionRouter, errorResponses } from "@api/config/router";
import { serializeRuleGroup, serializeRuleGroupList } from "@api/routes/rule-groups/serializer";
import { submitRulesApplyJob } from "@api/routes/rules/apply-job";
import { sessionPrincipal } from "@ndb/middleware";
import {
  API,
  applyRulesReqSchema,
  createRuleGroupReqSchema,
  jobCreatedSchema,
  patchRuleGroupReqSchema,
  ruleGroupIdParamsSchema,
  ruleGroupListQuerySchema,
  ruleGroupListSchema,
  ruleGroupSchema,
} from "@ndb/platform";

const ruleGroupRoutes = createSessionRouter()
  .endpoint(
    {
      method: "get",
      path: API.ruleGroups.list,
      request: { query: ruleGroupListQuerySchema },
      responses: {
        200: { content: jsonMedia(ruleGroupListSchema), description: "Rule group list" },
        401: errorResponses[401],
      },
    },
    async (c) => {
      const query = c.req.valid("query");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const result = await c.get("services").ruleGroupService.list(user, auth.acr, query);
      return c.json(serializeRuleGroupList(result.items, result.total), 200);
    }
  )
  .endpoint(
    {
      method: "post",
      path: API.ruleGroups.create,
      request: { body: jsonBody(createRuleGroupReqSchema) },
      responses: {
        201: { content: jsonMedia(ruleGroupSchema), description: "Rule group created" },
        400: errorResponses[400],
        401: errorResponses[401],
      },
    },
    async (c) => {
      const body = c.req.valid("json");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const created = await c.get("services").ruleGroupService.create(user, auth.acr, body);
      return c.json(serializeRuleGroup(created), 201);
    }
  )
  .endpoint(
    {
      method: "get",
      path: API.ruleGroups.get,
      request: { params: ruleGroupIdParamsSchema },
      responses: {
        200: { content: jsonMedia(ruleGroupSchema), description: "Rule group details" },
        401: errorResponses[401],
        404: errorResponses[404],
      },
    },
    async (c) => {
      const { ruleGroupId } = c.req.valid("param");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const row = await c.get("services").ruleGroupService.get(user, auth.acr, ruleGroupId);
      return c.json(serializeRuleGroup(row), 200);
    }
  )
  .endpoint(
    {
      method: "patch",
      path: API.ruleGroups.patch,
      request: {
        params: ruleGroupIdParamsSchema,
        body: jsonBody(patchRuleGroupReqSchema),
      },
      responses: {
        200: { content: jsonMedia(ruleGroupSchema), description: "Rule group updated" },
        400: errorResponses[400],
        401: errorResponses[401],
        404: errorResponses[404],
      },
    },
    async (c) => {
      const body = c.req.valid("json");
      const { ruleGroupId } = c.req.valid("param");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const updated = await c
        .get("services")
        .ruleGroupService.update(user, auth.acr, ruleGroupId, body);
      return c.json(serializeRuleGroup(updated), 200);
    }
  )
  .endpoint(
    {
      method: "delete",
      path: API.ruleGroups.delete,
      request: { params: ruleGroupIdParamsSchema },
      responses: {
        204: { description: "Rule group deleted" },
        401: errorResponses[401],
        404: errorResponses[404],
      },
    },
    async (c) => {
      const { ruleGroupId } = c.req.valid("param");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      await c.get("services").ruleGroupService.delete(user, auth.acr, ruleGroupId);
      return c.body(null, 204);
    }
  )
  .endpoint(
    {
      method: "post",
      path: API.ruleGroups.apply,
      request: {
        params: ruleGroupIdParamsSchema,
        body: jsonBody(applyRulesReqSchema),
      },
      responses: {
        202: { content: jsonMedia(jobCreatedSchema), description: "Rule group apply job accepted" },
        400: errorResponses[400],
        401: errorResponses[401],
        404: errorResponses[404],
        409: errorResponses[409],
      },
    },
    async (c) => {
      const { ruleGroupId } = c.req.valid("param");
      const body = c.req.valid("json");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const services = c.get("services");
      await services.ruleGroupService.get(user, auth.acr, ruleGroupId);

      return c.json(
        await submitRulesApplyJob(services, user.id, { type: "group", groupId: ruleGroupId }, body),
        202
      );
    }
  );

export default ruleGroupRoutes;
