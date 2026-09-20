import { jsonBody, jsonMedia } from "@api/config/http";
import { createSessionRouter, errorResponses } from "@api/config/router";
import { serializeUser, serializeUserList } from "@api/routes/auth/serializer";
import { toUserListQuery } from "@api/routes/users/helpers";
import { sessionPrincipal } from "@ndb/middleware";
import {
  API,
  adminUserListQuerySchema,
  patchAdminUserReqSchema,
  registerUserReqSchema,
  userIdParamsSchema,
  userListSchema,
  userSchema,
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
      const created = await c.get("services").authService.register(user, auth.acr, body);
      await Promise.all([
        c.get("services").accountService.ensureSystemAccounts(created.id),
        c.get("services").categoryService.ensureDefaultCategories(created.id),
      ]);
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
        .userService.list(user, auth.acr, toUserListQuery(c.req.valid("query")));
      return c.json(serializeUserList(result.items, result.total), 200);
    }
  )
  .endpoint(
    {
      method: "patch",
      path: API.users.patch,
      request: {
        params: userIdParamsSchema,
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
      const { userId } = c.req.valid("param");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const updated = await c.get("services").userService.update(user, auth.acr, userId, body);
      return c.json(serializeUser(updated), 200);
    }
  )
  .endpoint(
    {
      method: "delete",
      path: API.users.delete,
      request: { params: userIdParamsSchema },
      responses: {
        204: { description: "User deleted" },
        401: errorResponses[401],
        403: errorResponses[403],
      },
    },
    async (c) => {
      const { userId } = c.req.valid("param");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      await c.get("services").userService.delete(user, auth.acr, userId);
      return c.body(null, 204);
    }
  );

export default adminRoutes;
