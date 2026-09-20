import { createBankHandler } from "@statements/banks/handlers/base";
import { bobSharedHandlerConfig } from "@statements/banks/institutions/bob/shared/config";

export const BobDefaultHandler = createBankHandler({
  mailSubjects: () => [
    "E-statement for your BOB",
    "E-statement for your BOBCARD",
    "Duplicate Statement from BOB Card",
  ],
  ...bobSharedHandlerConfig,
});
