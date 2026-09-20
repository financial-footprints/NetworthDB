import { createDbClient } from "@database/client";
import { parseDbEnv } from "@database/env";
import { accounts } from "@database/schema/index";
import { resolveCreditCardCatalogTitle } from "@ndb/platform";
import { loadCardCatalogs } from "@ndb/platform/cards/server";
import { eq } from "drizzle-orm";

const catalogs = await loadCardCatalogs();
const titles = new Map(
  [...catalogs.values()].map((catalog) => [catalog.registry_key, catalog.display_name])
);

const dbHandle = createDbClient({ config: parseDbEnv() });

try {
  const rows = await dbHandle.client
    .select({
      id: accounts.id,
      bank: accounts.bank,
      variant: accounts.variant,
      label: accounts.label,
    })
    .from(accounts)
    .where(eq(accounts.accountType, "credit_card"));

  let updated = 0;
  for (const row of rows) {
    const title = resolveCreditCardCatalogTitle(row.bank, row.variant, titles);
    if (!title || title === row.label) {
      continue;
    }
    await dbHandle.client
      .update(accounts)
      .set({ label: title, updatedAt: new Date() })
      .where(eq(accounts.id, row.id));
    updated += 1;
  }
  console.log(`database.accounts.credit-card-labels.backfill ${updated}`);
} finally {
  await dbHandle.close();
}
