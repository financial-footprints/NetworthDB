import { createBankHandler } from "@statements/banks/handlers/base";
import { yesSharedHandlerConfig } from "@statements/banks/institutions/yes/shared/config";

export const YesAceHandler = createBankHandler({
  mailSubjects: () => ["Your YES_BANK_ACE Rupay Credit Card E-Statement"],
  ...yesSharedHandlerConfig,
});
