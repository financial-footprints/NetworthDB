import { edgeSummaryClosing, edgeSummaryOpening } from "@statements/banks/helpers/index";
import { topRangeStatementDate, topRangeStatementPeriod } from "@statements/banks/shared/mixins";

export const federalEdgeFamilyConfig = {
  getStatementDate: (text: string) => topRangeStatementDate(text, " - ", 2000),
  getStatementPeriod: (text: string) => topRangeStatementPeriod(text, " - ", 2000),
  getOpeningBalance: edgeSummaryOpening,
  getClosingBalance: edgeSummaryClosing,
};
