import { jsonMedia } from "@api/config/http";
import { createSessionRouter, errorResponses } from "@api/config/router";
import { serializeMeDetails } from "@api/routes/auth/serializer";
import { API, meDetailsSchema } from "@ndb/platform";

const meRoutes = createSessionRouter();

meRoutes.endpoint(
  {
    method: "get",
    path: API.users.me.get,
    responses: {
      200: { content: jsonMedia(meDetailsSchema), description: "Current user profile" },
      401: errorResponses[401],
    },
  },
  async (c) => {
    const user = c.get("principal").user;
    const [vault, multifactorState, clientSettings] = await Promise.all([
      c.get("services").vaultService.get(user.id),
      c.get("services").authService.multifactor.buildState(user),
      c.get("services").userService.getClientSettings(user.id),
    ]);
    return c.json(serializeMeDetails(user, vault, multifactorState, clientSettings), 200);
  }
);

export default meRoutes;
