import { jsonMedia } from "@api/config/http";
import { createSessionRouter, errorResponses } from "@api/config/router";
import { serializeAccountDetails } from "@api/routes/accounts/metadata/serializer";
import { sessionPrincipal } from "@ndb/middleware";
import { API, accountDetailsSchema, accountIdParamsSchema } from "@ndb/platform";

const metadataRoutes = createSessionRouter().endpoint(
  {
    method: "get",
    path: API.accounts.metadata.get,
    request: { params: accountIdParamsSchema },
    responses: {
      200: { content: jsonMedia(accountDetailsSchema), description: "Account metadata" },
      401: errorResponses[401],
      404: errorResponses[404],
    },
  },
  async (c) => {
    const { accountId } = c.req.valid("param");
    const { user, auth } = sessionPrincipal(c.get("principal"));
    const metadata = await c
      .get("services")
      .accountService.statements.getMetadata(user, auth.acr, accountId);
    const includeSecrets = c.get("config").advancedSecurity.sensitiveBackups;
    return c.json(serializeAccountDetails(metadata, includeSecrets), 200);
  }
);

export default metadataRoutes;
