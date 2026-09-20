import { jsonMedia } from "@api/config/http";
import { createSessionRouter, errorResponses } from "@api/config/router";
import { serializeDashboardSnapshot } from "@api/routes/dashboard/serializer";
import { sessionPrincipal } from "@ndb/middleware";
import { API, dashboardQuerySchema, dashboardSnapshotSchema } from "@ndb/platform";

const dashboardRoutes = createSessionRouter().endpoint(
  {
    method: "get",
    path: API.dashboard.get,
    request: { query: dashboardQuerySchema },
    responses: {
      200: { content: jsonMedia(dashboardSnapshotSchema), description: "Dashboard snapshot" },
      400: errorResponses[400],
      401: errorResponses[401],
    },
  },
  async (c) => {
    const query = c.req.valid("query");
    const { user, auth } = sessionPrincipal(c.get("principal"));
    const snapshot = await c
      .get("services")
      .dashboardService.getSnapshot(user, auth.acr, query.from, query.to);
    return c.json(serializeDashboardSnapshot(snapshot), 200);
  }
);

export default dashboardRoutes;
