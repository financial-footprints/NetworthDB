import { createSessionRouter, errorResponses } from "@api/config/router";
import { jsonMedia } from "@api/routes/auth/helpers";
import { serializeMeDetails } from "@api/routes/auth/serializer";
import { API, meDetailsSchema } from "@ndb/platform";

const meRoutes = createSessionRouter();

meRoutes.endpoint(
  {
    method: "get",
    path: API.users.me.details,
    responses: {
      200: { content: jsonMedia(meDetailsSchema), description: "Current user profile" },
      401: errorResponses[401],
    },
  },
  async (c) => {
    const user = c.get("principal").user;
    const vault = await c.get("services").vault.get(user.id);
    return c.json(serializeMeDetails(user, vault), 200);
  }
);

export default meRoutes;
