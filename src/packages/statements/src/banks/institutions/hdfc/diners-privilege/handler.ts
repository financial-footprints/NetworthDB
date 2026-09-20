import { createBankHandler } from "@statements/banks/handlers/base";
import { HdfcDefaultHandler } from "@statements/banks/institutions/hdfc/default/handler";
import { hdfcNamedVariantShared } from "@statements/banks/institutions/hdfc/shared/config";

export const HdfcDinersHandler = createBankHandler({
  mailSubjects: () => ["Your HDFC Bank - Diners Club International Credit Card Statement"],
  ...hdfcNamedVariantShared(HdfcDefaultHandler),
});
