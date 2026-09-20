import { createBankHandler } from "@statements/banks/handlers/base";
import {
  BOB_EASY_DROP,
  bobSharedHandlerConfig,
} from "@statements/banks/institutions/bob/shared/config";
import { cleanBobStatementText } from "@statements/banks/institutions/bob/shared/helpers";

export const BobEasyHandler = createBankHandler({
  mailSubjects: () => [
    "E-statement for your BOB EASY credit card ending in",
    "E-statement for your BOBCARD EASY credit card ending in",
    "E-statement for your BOBCARD RUPAY EASY credit card ending",
    "Duplicate Statement from BOB Card",
  ],
  ...bobSharedHandlerConfig,
  dropSections: () => BOB_EASY_DROP,
  cleanText(raw: string) {
    return cleanBobStatementText(raw, BOB_EASY_DROP);
  },
});
