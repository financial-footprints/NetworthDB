import { createSessionRouter, errorResponses } from "@api/config/router";
import { jsonBody, jsonMedia } from "@api/routes/auth/helpers";
import { serializeSources } from "@api/routes/sources/serializer";
import { sessionPrincipal } from "@ndb/middleware";
import { API, putSourcesReqSchema, sourcesSchema } from "@ndb/platform";

const sourcesRoutes = createSessionRouter()
  .endpoint(
    {
      method: "get",
      path: API.sources,
      responses: {
        200: { content: jsonMedia(sourcesSchema), description: "Statement sources" },
        401: errorResponses[401],
      },
    },
    async (c) => {
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const includeSecrets = c.get("config").advancedSecurity.sensitiveBackups;
      const sources = await c.get("services").sources.getSources(user, auth.acr);
      return c.json(serializeSources(sources, includeSecrets), 200);
    }
  )
  .endpoint(
    {
      method: "put",
      path: API.sources,
      request: { body: jsonBody(putSourcesReqSchema) },
      responses: {
        200: { content: jsonMedia(sourcesSchema), description: "Statement sources updated" },
        400: errorResponses[400],
        401: errorResponses[401],
      },
    },
    async (c) => {
      const body = c.req.valid("json");
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const includeSecrets = c.get("config").advancedSecurity.sensitiveBackups;
      const sources = await c.get("services").sources.updateSources(user, auth.acr, body);
      return c.json(serializeSources(sources, includeSecrets), 200);
    }
  );

export default sourcesRoutes;
