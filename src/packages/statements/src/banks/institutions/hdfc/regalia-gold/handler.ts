import { createBankHandler } from "@statements/banks/handlers/base";
import { HdfcDefaultHandler } from "@statements/banks/institutions/hdfc/default/handler";
import { hdfcNamedVariantShared } from "@statements/banks/institutions/hdfc/shared/config";

export const HdfcRegaliaGoldHandler = createBankHandler({
  mailSubjects: () => ["Your HDFC Bank - HDFC Bank Regalia Gold Credit Card Statement"],
  ...hdfcNamedVariantShared(HdfcDefaultHandler),
});
