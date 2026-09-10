import { createSessionRouter, errorResponses } from "@api/config/router";
import { jsonMedia } from "@api/routes/auth/helpers";
import { serializeEmpty } from "@api/routes/auth/serializer";
import { sessionPrincipal } from "@ndb/middleware";
import { API, emptySchema } from "@ndb/platform";

const sessionRoutes = createSessionRouter();

sessionRoutes.endpoint(
  {
    method: "post",
    path: API.auth.session.logout,
    responses: {
      200: { content: jsonMedia(emptySchema), description: "Logged out" },
      401: errorResponses[401],
    },
  },
  async (c) => {
    const { session } = sessionPrincipal(c.get("principal"));
    await c.get("services").auth.logout(session.id);
    return c.json(serializeEmpty(), 200);
  }
);

export default sessionRoutes;
