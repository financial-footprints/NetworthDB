import type { BaseEnv } from "@api/config/hono-env";
import { jsonMedia } from "@api/config/http";
import { ApiRouter, errorResponses } from "@api/config/router";
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
    const health = await c.get("services").healthService.check();
    return c.json(healthResponseSchema.parse({ ok: health.ok }), 200);
  }
);

export default healthRoutes;
