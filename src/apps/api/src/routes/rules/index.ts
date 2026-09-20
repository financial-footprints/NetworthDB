import { jsonBody, jsonMedia } from "@api/config/http";
import { createSessionRouter, errorResponses } from "@api/config/router";
import { submitRulesApplyJob } from "@api/routes/rules/apply-job";
import {
  serializeRule,
  serializeRuleList,
  serializeTestRuleResult,
} from "@api/routes/rules/serializer";
import { sessionPrincipal } from "@ndb/middleware";
import {
  API,
  applyRulesReqSchema,
  createRuleReqSchema,
  jobCreatedSchema,
  patchRuleReqSchema,
  ruleIdParamsSchema,
  ruleListQuerySchema,
  ruleListSchema,
  ruleSchema,
  testRuleReqSchema,
  testRuleSchema,
} from "@ndb/platform";

const ruleRoutes = createSessionRouter()
  .endpoint(
    {
      method: "get",
      path: API.rules.list,
      request: { query: ruleListQuerySchema },
      responses: {
        200: { content: jsonMedia(ruleListSchema), description: "Rule list" },
        400: errorResponses[400],
        401: errorResponses[401],
        404: errorResponses[404],
      },
    },
    async (c) => {
      const query = c.req.valid("query");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const result = await c.get("services").ruleService.list(user, auth.acr, query);
      return c.json(serializeRuleList(result.items, result.total), 200);
    }
  )
  .endpoint(
    {
      method: "post",
      path: API.rules.create,
      request: { body: jsonBody(createRuleReqSchema) },
      responses: {
        201: { content: jsonMedia(ruleSchema), description: "Rule created" },
        400: errorResponses[400],
        401: errorResponses[401],
        404: errorResponses[404],
      },
    },
    async (c) => {
      const body = c.req.valid("json");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const { groupId, ...rest } = body;
      const created = await c.get("services").ruleService.create(user, auth.acr, groupId, rest);
      return c.json(serializeRule(created), 201);
    }
  )
  .endpoint(
    {
      method: "get",
      path: API.rules.get,
      request: { params: ruleIdParamsSchema },
      responses: {
        200: { content: jsonMedia(ruleSchema), description: "Rule details" },
        401: errorResponses[401],
        404: errorResponses[404],
      },
    },
    async (c) => {
      const { ruleId } = c.req.valid("param");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const row = await c.get("services").ruleService.get(user, auth.acr, ruleId);
      return c.json(serializeRule(row), 200);
    }
  )
  .endpoint(
    {
      method: "patch",
      path: API.rules.patch,
      request: {
        params: ruleIdParamsSchema,
        body: jsonBody(patchRuleReqSchema),
      },
      responses: {
        200: { content: jsonMedia(ruleSchema), description: "Rule updated" },
        400: errorResponses[400],
        401: errorResponses[401],
        404: errorResponses[404],
      },
    },
    async (c) => {
      const body = c.req.valid("json");
      const { ruleId } = c.req.valid("param");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const updated = await c.get("services").ruleService.update(user, auth.acr, ruleId, body);
      return c.json(serializeRule(updated), 200);
    }
  )
  .endpoint(
    {
      method: "delete",
      path: API.rules.delete,
      request: { params: ruleIdParamsSchema },
      responses: {
        204: { description: "Rule deleted" },
        401: errorResponses[401],
        404: errorResponses[404],
      },
    },
    async (c) => {
      const { ruleId } = c.req.valid("param");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      await c.get("services").ruleService.delete(user, auth.acr, ruleId);
      return c.body(null, 204);
    }
  )
  .endpoint(
    {
      method: "post",
      path: API.rules.test,
      request: {
        params: ruleIdParamsSchema,
        body: jsonBody(testRuleReqSchema),
      },
      responses: {
        200: { content: jsonMedia(testRuleSchema), description: "Rule test result" },
        400: errorResponses[400],
        401: errorResponses[401],
        404: errorResponses[404],
      },
    },
    async (c) => {
      const { ruleId } = c.req.valid("param");
      const body = c.req.valid("json");
      const { user } = sessionPrincipal(c.get("principal"));
      const result = await c.get("services").ruleEngineService.testRule(user.id, ruleId, body);
      return c.json(serializeTestRuleResult(result), 200);
    }
  )
  .endpoint(
    {
      method: "post",
      path: API.rules.apply,
      request: {
        params: ruleIdParamsSchema,
        body: jsonBody(applyRulesReqSchema),
      },
      responses: {
        202: { content: jsonMedia(jobCreatedSchema), description: "Rules apply job accepted" },
        400: errorResponses[400],
        401: errorResponses[401],
        404: errorResponses[404],
        409: errorResponses[409],
      },
    },
    async (c) => {
      const { ruleId } = c.req.valid("param");
      const body = c.req.valid("json");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const services = c.get("services");
      await services.ruleService.get(user, auth.acr, ruleId);

      return c.json(
        await submitRulesApplyJob(services, user.id, { type: "rule", ruleId }, body),
        202
      );
    }
  );

export default ruleRoutes;
