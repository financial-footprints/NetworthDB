import type { BaseEnv } from "@api/config/hono-env";
import { ApiRouter } from "@api/config/router";
import { jsonMedia } from "@api/routes/auth/helpers";
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
          advanced_security: {
            disabled: advancedSecurity.disabled,
          },
        },
        errors: [],
      }),
      200
    );
  }
);

export default configRoutes;
