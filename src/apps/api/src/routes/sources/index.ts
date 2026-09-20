import { jsonBody, jsonMedia } from "@api/config/http";
import { createSessionRouter, errorResponses } from "@api/config/router";
import { serializeSources } from "@api/routes/sources/serializer";
import { sessionPrincipal } from "@ndb/middleware";
import { API, putSourcesReqSchema, sourcesSchema } from "@ndb/platform";

const sourcesRoutes = createSessionRouter()
  .endpoint(
    {
      method: "get",
      path: API.sources.get,
      responses: {
        200: { content: jsonMedia(sourcesSchema), description: "Statement sources" },
        401: errorResponses[401],
      },
    },
    async (c) => {
      const { user, auth } = sessionPrincipal(c.get("principal"));
      const includeSecrets = c.get("config").advancedSecurity.sensitiveBackups;
      const sources = await c.get("services").sourcesService.getSources(user, auth.acr);
      return c.json(serializeSources(sources, includeSecrets), 200);
    }
  )
  .endpoint(
    {
      method: "put",
      path: API.sources.put,
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
      const sources = await c.get("services").sourcesService.updateSources(user, auth.acr, body);
      return c.json(serializeSources(sources, includeSecrets), 200);
    }
  );

export default sourcesRoutes;
