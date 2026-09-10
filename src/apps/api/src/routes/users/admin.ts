import { createSessionRouter, errorResponses } from "@api/config/router";
import { jsonBody, jsonMedia, toUserListQuery } from "@api/routes/auth/helpers";
import {
  serializeEmpty,
  serializePublicUser,
  serializePublicUserList,
} from "@api/routes/auth/serializer";
import { sessionPrincipal } from "@ndb/middleware";
import {
  API,
  adminUserIdParamsSchema,
  adminUserListQuerySchema,
  emptySchema,
  patchAdminUserReqSchema,
  publicUserListSchema,
  publicUserSchema,
  registerUserReqSchema,
} from "@ndb/platform";

const adminRoutes = createSessionRouter()
  .endpoint(
    {
      method: "post",
      path: API.users.create,
      request: { body: jsonBody(registerUserReqSchema) },
      responses: {
        201: { content: jsonMedia(publicUserSchema), description: "User created" },
        400: errorResponses[400],
        401: errorResponses[401],
        403: errorResponses[403],
      },
    },
    async (c) => {
      const body = c.req.valid("json");
      const { user: actor, jwt } = sessionPrincipal(c.get("principal"));
      const user = await c.get("services").user.register(actor, jwt.acr, body);
      return c.json(serializePublicUser(user), 201);
    }
  )
  .endpoint(
    {
      method: "get",
      path: API.users.list,
      request: { query: adminUserListQuerySchema },
      responses: {
        200: { content: jsonMedia(publicUserListSchema), description: "User list" },
        401: errorResponses[401],
        403: errorResponses[403],
      },
    },
    async (c) => {
      const { user, jwt } = sessionPrincipal(c.get("principal"));
      const result = await c
        .get("services")
        .user.list(user, jwt.acr, toUserListQuery(c.req.valid("query")));
      return c.json(serializePublicUserList(result.items, result.total), 200);
    }
  )
  .endpoint(
    {
      method: "patch",
      path: API.users.details,
      request: {
        params: adminUserIdParamsSchema,
        body: jsonBody(patchAdminUserReqSchema),
      },
      responses: {
        200: { content: jsonMedia(publicUserSchema), description: "User updated" },
        400: errorResponses[400],
        401: errorResponses[401],
        403: errorResponses[403],
      },
    },
    async (c) => {
      const body = c.req.valid("json");
      const { id } = c.req.valid("param");
      const { user: actor, jwt } = sessionPrincipal(c.get("principal"));
      const user = await c.get("services").user.update(actor, jwt.acr, id, body);
      return c.json(serializePublicUser(user), 200);
    }
  )
  .endpoint(
    {
      method: "delete",
      path: API.users.details,
      request: { params: adminUserIdParamsSchema },
      responses: {
        200: { content: jsonMedia(emptySchema), description: "User deleted" },
        401: errorResponses[401],
        403: errorResponses[403],
      },
    },
    async (c) => {
      const { id } = c.req.valid("param");
      const { user, jwt } = sessionPrincipal(c.get("principal"));
      await c.get("services").user.delete(user, jwt.acr, id);
      return c.json(serializeEmpty(), 200);
    }
  );

export default adminRoutes;
