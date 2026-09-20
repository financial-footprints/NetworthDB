import { createBankHandler } from "@statements/banks/handlers/base";
import { pnbHandlerConfig } from "@statements/banks/institutions/pnb/shared/config";

export const PnbHandler = createBankHandler(pnbHandlerConfig);
