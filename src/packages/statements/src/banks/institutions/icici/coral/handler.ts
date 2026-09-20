import { createBankHandler } from "@statements/banks/handlers/base";
import { IciciDefaultHandler } from "@statements/banks/institutions/icici/default/handler";
import { iciciSharedHandlerConfig } from "@statements/banks/institutions/icici/shared/config";

export const IciciCoralHandler = createBankHandler({
  mailSubjects: () => IciciDefaultHandler.mailSubjects(),
  ...iciciSharedHandlerConfig,
});
