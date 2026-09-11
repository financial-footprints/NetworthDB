import { createSessionRouter, errorResponses } from "@api/config/router";
import { serializeBankList } from "@api/routes/accounts/banks/serializer";
import { jsonMedia } from "@api/routes/auth/helpers";
import { sessionPrincipal } from "@ndb/middleware";
import { API, bankListSchema } from "@ndb/platform";

const banksRoutes = createSessionRouter().endpoint(
  {
    method: "get",
    path: API.accounts.banks,
    responses: {
      200: { content: jsonMedia(bankListSchema), description: "Bank handlers" },
      401: errorResponses[401],
    },
  },
  async (c) => {
    const { user, auth } = sessionPrincipal(c.get("principal"));
    const items = await c.get("services").account.listBanks(user, auth.acr);
    return c.json(serializeBankList(items), 200);
  }
);

export default banksRoutes;
