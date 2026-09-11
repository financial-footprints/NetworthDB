import type { Bank } from "@ndb/core";
import type { Bank as NativeBank } from "../../native.d.ts";

export const bank = {
  toDomain: (bank: NativeBank): Bank => ({
    key: bank.key,
    bank: bank.bank,
    variant: bank.variant ?? null,
    accountType: bank.accountType,
  }),
};
