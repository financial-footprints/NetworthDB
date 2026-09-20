import { createBankHandler } from "@statements/banks/handlers/base";
import { iciciSharedHandlerConfig } from "@statements/banks/institutions/icici/shared/config";

export const IciciDefaultHandler = createBankHandler({
  mailSubjects: () => ["ICICI Bank Credit Card Statement for the period"],
  ...iciciSharedHandlerConfig,
});
