import { createBankHandler } from "@statements/banks/handlers/base";
import { indusindSharedHandlerConfig } from "@statements/banks/institutions/indusind/shared/config";

export const IndusindDefaultHandler = createBankHandler({
  mailSubjects: () => ["IndusInd Bank Credit Card"],
  ...indusindSharedHandlerConfig,
});
