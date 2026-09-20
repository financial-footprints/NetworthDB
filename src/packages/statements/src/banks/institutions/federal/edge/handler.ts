import { type BankHandler, createBankHandler } from "@statements/banks/handlers/base";
import {
  injectEdgeSummaryLabels,
  purgeDropSections,
  sanitizeStatementText,
  trimByMarkers,
} from "@statements/banks/helpers/index";
import { federalEdgeFamilyConfig } from "@statements/banks/institutions/federal/shared/config";

export const FederalEdgeHandler = createBankHandler({
  mailSubjects: () => ["Edge Federal Bank Credit Card Statement"],
  trimEnd: () => ["End of Transactions"],
  dropSections: () => ["IMPORTANT INFORMATION", "Issued by"],
  cleanText(this: BankHandler, raw) {
    const trimmed = trimByMarkers(raw, this.trimStart(), this.trimEnd());
    const sanitized = sanitizeStatementText(trimmed);
    const purged = purgeDropSections(sanitized, this.dropSections());
    return injectEdgeSummaryLabels(purged);
  },
  ...federalEdgeFamilyConfig,
});
