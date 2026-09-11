import { createSessionRouter, errorResponses } from "@api/config/router";
import { jsonBody, jsonMedia, toUserListQuery } from "@api/routes/auth/helpers";
import { serializeEmpty, serializeUser, serializeUserList } from "@api/routes/auth/serializer";
import { sessionPrincipal } from "@ndb/middleware";
import {
  API,
  adminUserListQuerySchema,
  emptySchema,
  patchAdminUserReqSchema,
  registerUserReqSchema,
  userListSchema,
  userSchema,
  uuidIdParamsSchema,
} from "@ndb/platform";

const adminRoutes = createSessionRouter()
  .endpoint(
    {
      method: "post",
      path: API.users.create,
      request: { body: jsonBody(registerUserReqSchema) },
      responses: {
        201: { content: jsonMedia(userSchema), description: "User created" },
        400: errorResponses[400],
        401: errorResponses[401],
        403: errorResponses[403],
      },
    },
    async (c) => {
      const body = c.req.valid("json");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const created = await c.get("services").auth.register(user, auth.acr, body);
      return c.json(serializeUser(created), 201);
    }
  )
  .endpoint(
    {
      method: "get",
      path: API.users.list,
      request: { query: adminUserListQuerySchema },
      responses: {
        200: { content: jsonMedia(userListSchema), description: "User list" },
        401: errorResponses[401],
        403: errorResponses[403],
      },
    },
    async (c) => {
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const result = await c
        .get("services")
        .user.list(user, auth.acr, toUserListQuery(c.req.valid("query")));
      return c.json(serializeUserList(result.items, result.total), 200);
    }
  )
  .endpoint(
    {
      method: "patch",
      path: API.users.details,
      request: {
        params: uuidIdParamsSchema,
        body: jsonBody(patchAdminUserReqSchema),
      },
      responses: {
        200: { content: jsonMedia(userSchema), description: "User updated" },
        400: errorResponses[400],
        401: errorResponses[401],
        403: errorResponses[403],
      },
    },
    async (c) => {
      const body = c.req.valid("json");
      const { id } = c.req.valid("param");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const updated = await c.get("services").user.update(user, auth.acr, id, body);
      return c.json(serializeUser(updated), 200);
    }
  )
  .endpoint(
    {
      method: "delete",
      path: API.users.details,
      request: { params: uuidIdParamsSchema },
      responses: {
        200: { content: jsonMedia(emptySchema), description: "User deleted" },
        401: errorResponses[401],
        403: errorResponses[403],
      },
    },
    async (c) => {
      const { id } = c.req.valid("param");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      await c.get("services").user.delete(user, auth.acr, id);
      return c.json(serializeEmpty(), 200);
    }
  );

export default adminRoutes;
