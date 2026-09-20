import { createBankHandler } from "@statements/banks/handlers/base";
import { csbSharedHandlerConfig } from "@statements/banks/institutions/csb/shared/config";

export const CsbDefaultHandler = createBankHandler({
  mailSubjects: () => ["Credit Card Statement"],
  ...csbSharedHandlerConfig,
});
