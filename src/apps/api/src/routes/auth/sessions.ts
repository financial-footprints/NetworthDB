import { createSessionRouter, errorResponses } from "@api/config/router";
import { sessionPrincipal } from "@ndb/middleware";
import { API } from "@ndb/platform";

const sessionRoutes = createSessionRouter();

sessionRoutes.endpoint(
  {
    method: "post",
    path: API.auth.session.logout,
    responses: {
      204: { description: "Logged out" },
      401: errorResponses[401],
    },
  },
  async (c) => {
    const { session } = sessionPrincipal(c.get("principal"));
    await c.get("services").authService.logout(session.id);
    return c.body(null, 204);
  }
);

export default sessionRoutes;
