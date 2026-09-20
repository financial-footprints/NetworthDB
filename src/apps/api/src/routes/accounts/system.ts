import { jsonMedia } from "@api/config/http";
import { createSessionRouter, errorResponses } from "@api/config/router";
import { serializeSystemAccounts } from "@api/routes/accounts/serializer";
import { sessionPrincipal } from "@ndb/middleware";
import { API, systemAccountsSchema } from "@ndb/platform";

const systemRoutes = createSessionRouter().endpoint(
  {
    method: "get",
    path: API.accounts.system.get,
    responses: {
      200: { content: jsonMedia(systemAccountsSchema), description: "System accounts" },
      401: errorResponses[401],
    },
  },
  async (c) => {
    const { user, auth } = sessionPrincipal(c.get("principal"));
    const items = await c.get("services").accountService.listSystemAccounts(user, auth.acr);
    return c.json(serializeSystemAccounts(items), 200);
  }
);

export default systemRoutes;
