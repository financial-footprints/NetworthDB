import { jsonMedia } from "@api/config/http";
import { createSessionRouter, errorResponses } from "@api/config/router";
import { sessionPrincipal } from "@ndb/middleware";
import { API, bankListSchema } from "@ndb/platform";

const banksRoutes = createSessionRouter().endpoint(
  {
    method: "get",
    path: API.accounts.banks.get,
    responses: {
      200: { content: jsonMedia(bankListSchema), description: "Bank handlers" },
      401: errorResponses[401],
    },
  },
  async (c) => {
    const { user, auth } = sessionPrincipal(c.get("principal"));
    const items = await c.get("services").accountService.statements.listBanks(user, auth.acr);
    return c.json(
      bankListSchema.parse({
        items: items.map((item) => ({
          key: item.key,
          bank: item.bank,
          variant: item.variant,
          accountType: item.accountType,
        })),
        total: items.length,
      }),
      200
    );
  }
);

export default banksRoutes;
