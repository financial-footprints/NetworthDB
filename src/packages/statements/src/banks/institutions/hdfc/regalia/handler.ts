import { createBankHandler } from "@statements/banks/handlers/base";
import { HdfcDefaultHandler } from "@statements/banks/institutions/hdfc/default/handler";
import { hdfcNamedVariantShared } from "@statements/banks/institutions/hdfc/shared/config";

export const HdfcRegaliaHandler = createBankHandler({
  mailSubjects: () => ["Your HDFC Bank - Regalia MasterCard Credit Card Statement"],
  ...hdfcNamedVariantShared(HdfcDefaultHandler),
});
