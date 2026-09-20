import {
  API,
  apiPath,
  type CardCatalog,
  type CreditCardCatalogListItem,
  creditCardCatalogBulkSchema,
  creditCardCatalogDetailsSchema,
} from "@ndb/platform";
import { apiRequest } from "@web/utils/api/client";
import { withSessionToken } from "@web/utils/api/routes/auth";
import { ApiError } from "@web/utils/api/types";

export type { CardCatalog, CreditCardCatalogListItem };

const catalogDetailsCache = new Map<string, Promise<CardCatalog>>();
let catalogBulkCache: Promise<CardCatalog[]> | null = null;

function catalogDetailsKey(bank: string, variant: string): string {
  return `${bank}/${variant}`;
}

async function loadCreditCard(bank: string, variant: string): Promise<CardCatalog> {
  const response = await withSessionToken((sessionToken) =>
    apiRequest(apiPath(API.creditCards.catalog.get, { bank, variant }), {
      sessionToken,
      schema: creditCardCatalogDetailsSchema,
    })
  );
  return response.data;
}

function readCreditCard(bank: string, variant: string): Promise<CardCatalog> {
  const key = catalogDetailsKey(bank, variant);
  let promise = catalogDetailsCache.get(key);
  if (!promise) {
    promise = loadCreditCard(bank, variant).catch((error: unknown) => {
      catalogDetailsCache.delete(key);
      throw error;
    });
    catalogDetailsCache.set(key, promise);
  }
  return promise;
}

export async function fetchCreditCardCatalogBulk(): Promise<CardCatalog[]> {
  if (!catalogBulkCache) {
    catalogBulkCache = withSessionToken((sessionToken) =>
      apiRequest(API.creditCards.catalog.bulk, {
        sessionToken,
        schema: creditCardCatalogBulkSchema,
      })
    )
      .then((response) => response.data.items)
      .catch((error: unknown) => {
        catalogBulkCache = null;
        throw error;
      });
  }
  return catalogBulkCache;
}

export function invalidateCreditCardCatalogBulk(): void {
  catalogBulkCache = null;
}

function normalizeCatalogVariant(variant: string | null | undefined): string {
  const trimmed = variant?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "default";
}

export async function fetchCreditCardForAccount(
  bank: string,
  variant: string | null | undefined
): Promise<CardCatalog | null> {
  const primary = normalizeCatalogVariant(variant);
  try {
    return await readCreditCard(bank, primary);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404 || primary === "default") {
      throw error;
    }
  }
  try {
    return await readCreditCard(bank, "default");
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}
