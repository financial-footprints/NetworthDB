import { type BankHandler, createBankHandler } from "@statements/banks/handlers/base";
import {
  injectEdgeSummaryLabels,
  purgeDropSections,
  sanitizeStatementText,
  trimByMarkers,
} from "@statements/banks/helpers/index";
import { csbSharedHandlerConfig } from "@statements/banks/institutions/csb/shared/config";

export const CsbEdgeHandler = createBankHandler({
  mailSubjects: () => ["Edge CSB Bank RuPay Credit Card Statement"],
  trimEnd: () => ["End of Transactions"],
  cleanText(this: BankHandler, raw) {
    const trimmed = trimByMarkers(raw, this.trimStart(), this.trimEnd());
    const sanitized = sanitizeStatementText(trimmed);
    const purged = purgeDropSections(sanitized, this.dropSections());
    return injectEdgeSummaryLabels(purged);
  },
  ...csbSharedHandlerConfig,
});
