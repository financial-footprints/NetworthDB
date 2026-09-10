import type { BaseEnv } from "@api/config/hono-env";
import { ApiRouter, errorResponses } from "@api/config/router";
import { jsonMedia } from "@api/routes/auth/helpers";
import { serializeHealth } from "@api/routes/health/serializer";
import { API, healthResponseSchema } from "@ndb/platform";

const healthRoutes = new ApiRouter<BaseEnv>().endpoint(
  {
    method: "get",
    path: API.health.get,
    responses: {
      200: {
        content: jsonMedia(healthResponseSchema),
        description: "Liveness check",
      },
      500: errorResponses[500],
    },
  },
  async (c) => {
    const health = await c.get("services").health.check();
    return c.json(serializeHealth(health.ok), 200);
  }
);

export default healthRoutes;
