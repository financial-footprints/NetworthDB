import { createBankHandler } from "@statements/banks/handlers/base";
import { IndusindDefaultHandler } from "@statements/banks/institutions/indusind/default/handler";
import { indusindSharedHandlerConfig } from "@statements/banks/institutions/indusind/shared/config";

export const IndusindAuraedgeHandler = createBankHandler({
  mailSubjects: () => IndusindDefaultHandler.mailSubjects(),
  ...indusindSharedHandlerConfig,
});
