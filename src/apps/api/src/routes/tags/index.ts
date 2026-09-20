import { jsonBody, jsonMedia } from "@api/config/http";
import { createSessionRouter, errorResponses } from "@api/config/router";
import { serializeTag, serializeTagList } from "@api/routes/tags/serializer";
import { sessionPrincipal } from "@ndb/middleware";
import {
  API,
  createTagReqSchema,
  patchTagReqSchema,
  tagIdParamsSchema,
  tagListQuerySchema,
  tagListSchema,
  tagSchema,
} from "@ndb/platform";

const tagRoutes = createSessionRouter()
  .endpoint(
    {
      method: "get",
      path: API.tags.list,
      request: { query: tagListQuerySchema },
      responses: {
        200: { content: jsonMedia(tagListSchema), description: "Tag list" },
        401: errorResponses[401],
      },
    },
    async (c) => {
      const query = c.req.valid("query");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const result = await c.get("services").tagService.list(user, auth.acr, query);
      return c.json(serializeTagList(result.items, result.total), 200);
    }
  )
  .endpoint(
    {
      method: "post",
      path: API.tags.create,
      request: { body: jsonBody(createTagReqSchema) },
      responses: {
        201: { content: jsonMedia(tagSchema), description: "Tag created" },
        400: errorResponses[400],
        401: errorResponses[401],
        409: errorResponses[409],
      },
    },
    async (c) => {
      const body = c.req.valid("json");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const created = await c.get("services").tagService.create(user, auth.acr, body);
      return c.json(serializeTag(created), 201);
    }
  )
  .endpoint(
    {
      method: "patch",
      path: API.tags.patch,
      request: {
        params: tagIdParamsSchema,
        body: jsonBody(patchTagReqSchema),
      },
      responses: {
        200: { content: jsonMedia(tagSchema), description: "Tag updated" },
        400: errorResponses[400],
        401: errorResponses[401],
        404: errorResponses[404],
        409: errorResponses[409],
      },
    },
    async (c) => {
      const body = c.req.valid("json");
      const { tagId } = c.req.valid("param");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const updated = await c.get("services").tagService.update(user, auth.acr, tagId, body);
      return c.json(serializeTag(updated), 200);
    }
  )
  .endpoint(
    {
      method: "delete",
      path: API.tags.delete,
      request: { params: tagIdParamsSchema },
      responses: {
        204: { description: "Tag deleted" },
        401: errorResponses[401],
        404: errorResponses[404],
      },
    },
    async (c) => {
      const { tagId } = c.req.valid("param");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      await c.get("services").tagService.delete(user, auth.acr, tagId);
      return c.body(null, 204);
    }
  );

export default tagRoutes;
