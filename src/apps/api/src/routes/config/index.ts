import type { BaseEnv } from "@api/config/hono-env";
import { jsonMedia } from "@api/config/http";
import { ApiRouter } from "@api/config/router";
import { API, configSchema } from "@ndb/platform";

const configRoutes = new ApiRouter<BaseEnv>().endpoint(
  {
    method: "get",
    path: API.config.get,
    responses: {
      200: { content: jsonMedia(configSchema), description: "Public API configuration" },
    },
  },
  async (c) => {
    const { advancedSecurity } = c.get("config");
    return c.json(
      configSchema.parse({
        data: {
          advancedSecurity: {
            disabled: advancedSecurity.disabled,
          },
        },
      }),
      200
    );
  }
);

export default configRoutes;
