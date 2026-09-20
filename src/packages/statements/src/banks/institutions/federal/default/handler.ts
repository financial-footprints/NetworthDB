import { createBankHandler } from "@statements/banks/handlers/base";
import { federalEdgeFamilyConfig } from "@statements/banks/institutions/federal/shared/config";

export const FederalDefaultHandler = createBankHandler({
  mailSubjects: () => ["Federal Bank Credit Card Statement"],
  ...federalEdgeFamilyConfig,
});
