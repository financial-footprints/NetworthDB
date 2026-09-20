import { type BankHandler, createBankHandler } from "@statements/banks/handlers/base";
import {
  purgeDropSections,
  sanitizeStatementText,
  trimByMarkers,
} from "@statements/banks/helpers/index";
import { IciciDefaultHandler } from "@statements/banks/institutions/icici/default/handler";
import {
  ICICI_DROP_SECTIONS,
  iciciSharedHandlerConfig,
} from "@statements/banks/institutions/icici/shared/config";

const SPENDS_OVERVIEW_PHRASE = /SPENDS\s+OVERVIEW/i;
const SPENDS_OVERVIEW_MARKER = "SPENDS OVERVIEW";

const AMAZON_TRIM_END = ["Earnings transfered to", "Amazon Pay balance*"];

export const IciciAmazonHandler = createBankHandler({
  ...iciciSharedHandlerConfig,
  mailSubjects: () => [
    "Amazon Pay ICICI Bank Credit Card Statement for the period",
    "ICICI Bank Credit Card Statement for the period",
  ],
  trimEnd: () => AMAZON_TRIM_END,
  dropSections: () => [
    ...ICICI_DROP_SECTIONS.filter((section) => section !== SPENDS_OVERVIEW_MARKER),
    "EARNINGS",
  ],
  cleanText(this: BankHandler, raw) {
    const trimmed = trimByMarkers(raw, [], IciciDefaultHandler.trimEnd());
    const sanitized = sanitizeStatementText(trimmed);
    const purged = purgeDropSections(sanitized, this.dropSections());
    return purged.replace(SPENDS_OVERVIEW_PHRASE, "");
  },
});
