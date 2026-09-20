import { jsonBody, jsonMedia } from "@api/config/http";
import { createSessionRouter, errorResponses } from "@api/config/router";
import { serializeCategory, serializeCategoryList } from "@api/routes/categories/serializer";
import { sessionPrincipal } from "@ndb/middleware";
import {
  API,
  categoryIdParamsSchema,
  categoryListQuerySchema,
  categoryListSchema,
  categorySchema,
  createCategoryReqSchema,
  patchCategoryReqSchema,
} from "@ndb/platform";

const categoryRoutes = createSessionRouter()
  .endpoint(
    {
      method: "get",
      path: API.categories.list,
      request: { query: categoryListQuerySchema },
      responses: {
        200: { content: jsonMedia(categoryListSchema), description: "Category list" },
        401: errorResponses[401],
      },
    },
    async (c) => {
      const query = c.req.valid("query");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const result = await c.get("services").categoryService.list(user, auth.acr, query);
      return c.json(serializeCategoryList(result.items, result.total), 200);
    }
  )
  .endpoint(
    {
      method: "post",
      path: API.categories.create,
      request: { body: jsonBody(createCategoryReqSchema) },
      responses: {
        201: { content: jsonMedia(categorySchema), description: "Category created" },
        400: errorResponses[400],
        401: errorResponses[401],
        409: errorResponses[409],
      },
    },
    async (c) => {
      const body = c.req.valid("json");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const created = await c.get("services").categoryService.create(user, auth.acr, body);
      return c.json(serializeCategory(created), 201);
    }
  )
  .endpoint(
    {
      method: "patch",
      path: API.categories.patch,
      request: {
        params: categoryIdParamsSchema,
        body: jsonBody(patchCategoryReqSchema),
      },
      responses: {
        200: { content: jsonMedia(categorySchema), description: "Category updated" },
        400: errorResponses[400],
        401: errorResponses[401],
        404: errorResponses[404],
        409: errorResponses[409],
      },
    },
    async (c) => {
      const body = c.req.valid("json");
      const { categoryId } = c.req.valid("param");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const updated = await c
        .get("services")
        .categoryService.update(user, auth.acr, categoryId, body);
      return c.json(serializeCategory(updated), 200);
    }
  )
  .endpoint(
    {
      method: "delete",
      path: API.categories.delete,
      request: { params: categoryIdParamsSchema },
      responses: {
        204: { description: "Category deleted" },
        401: errorResponses[401],
        404: errorResponses[404],
      },
    },
    async (c) => {
      const { categoryId } = c.req.valid("param");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      await c.get("services").categoryService.delete(user, auth.acr, categoryId);
      return c.body(null, 204);
    }
  );

export default categoryRoutes;
