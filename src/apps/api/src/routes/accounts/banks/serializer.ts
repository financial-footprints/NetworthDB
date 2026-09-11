import type { Bank } from "@ndb/core";
import { bankListSchema } from "@ndb/platform";

export function serializeBankList(items: Bank[]) {
  return bankListSchema.parse({
    data: {
      items: items.map((item) => ({
        key: item.key,
        bank: item.bank,
        variant: item.variant,
        account_type: item.accountType,
      })),
      total: items.length,
    },
    errors: [],
  });
}
