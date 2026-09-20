import { createBankHandler } from "@statements/banks/handlers/base";
import { yesSharedHandlerConfig } from "@statements/banks/institutions/yes/shared/config";

export const YesDefaultHandler = createBankHandler({
  mailSubjects: () => ["Your YES_BANK"],
  ...yesSharedHandlerConfig,
});
