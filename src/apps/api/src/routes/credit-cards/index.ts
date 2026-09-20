import { jsonMedia } from "@api/config/http";
import { createSessionRouter, errorResponses } from "@api/config/router";
import { getCardCatalogs } from "@api/routes/credit-cards/cache";
import {
  serializeCreditCardBenefit,
  serializeCreditCardCatalog,
  serializeCreditCardCatalogBulk,
  serializeCreditCardCatalogList,
} from "@api/routes/credit-cards/serializer";
import { EntityNotFoundError } from "@ndb/core";
import { sessionPrincipal } from "@ndb/middleware";
import {
  API,
  catalogBenefitSlotIds,
  creditCardBenefitSchema,
  creditCardBenefitSlotParamsSchema,
  creditCardCatalogBulkSchema,
  creditCardCatalogDetailsSchema,
  creditCardCatalogListQuerySchema,
  creditCardCatalogListSchema,
  creditCardCatalogParamsSchema,
} from "@ndb/platform";

const creditCardRoutes = createSessionRouter()
  .endpoint(
    {
      method: "get",
      path: API.creditCards.catalog.list,
      request: { query: creditCardCatalogListQuerySchema },
      responses: {
        200: {
          content: jsonMedia(creditCardCatalogListSchema),
          description: "Credit card catalog metadata",
        },
        401: errorResponses[401],
      },
    },
    async (c) => {
      const query = c.req.valid("query");
      sessionPrincipal(c.get("principal"));
      const catalogs = await getCardCatalogs();
      const items = [...catalogs.values()].filter((catalog) => {
        if (!query.tag) {
          return true;
        }
        return catalog.tags.includes(query.tag);
      });
      return c.json(serializeCreditCardCatalogList(items), 200);
    }
  )
  .endpoint(
    {
      method: "get",
      path: API.creditCards.catalog.bulk,
      responses: {
        200: {
          content: jsonMedia(creditCardCatalogBulkSchema),
          description: "Full credit card catalogs for comparison",
        },
        401: errorResponses[401],
      },
    },
    async (c) => {
      sessionPrincipal(c.get("principal"));
      const catalogs = await getCardCatalogs();
      return c.json(serializeCreditCardCatalogBulk([...catalogs.values()]), 200);
    }
  )
  .endpoint(
    {
      method: "get",
      path: API.creditCards.catalog.get,
      request: { params: creditCardCatalogParamsSchema },
      responses: {
        200: {
          content: jsonMedia(creditCardCatalogDetailsSchema),
          description: "Credit card catalog",
        },
        401: errorResponses[401],
        404: errorResponses[404],
      },
    },
    async (c) => {
      const { bank, variant } = c.req.valid("param");
      sessionPrincipal(c.get("principal"));
      const catalogs = await getCardCatalogs();
      const catalog = catalogs.get(`${bank}/${variant}`);
      if (!catalog) {
        throw new EntityNotFoundError("CreditCardCatalog", `${bank}/${variant}`);
      }
      return c.json(serializeCreditCardCatalog(catalog), 200);
    }
  )
  .endpoint(
    {
      method: "get",
      path: API.creditCards.benefits.get,
      request: { params: creditCardBenefitSlotParamsSchema },
      responses: {
        200: {
          content: jsonMedia(creditCardBenefitSchema),
          description: "Cards for one catalog benefit slot",
        },
        400: errorResponses[400],
        401: errorResponses[401],
        404: errorResponses[404],
      },
    },
    async (c) => {
      const { slotId } = c.req.valid("param");
      sessionPrincipal(c.get("principal"));
      if (!catalogBenefitSlotIds().includes(slotId)) {
        throw new EntityNotFoundError("CreditCardBenefit", slotId);
      }
      const catalogs = await getCardCatalogs();
      return c.json(serializeCreditCardBenefit(slotId, [...catalogs.values()]), 200);
    }
  );

export default creditCardRoutes;
