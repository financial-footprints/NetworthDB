import * as pnbLayouts from "@statements/banks/institutions/pnb/shared/layouts";

export const pnbHandlerConfig = {
  mailSubjects: () => ["Your PNB Credit Card Statement for the month"],
  trimEnd: () => ["********** End of Statement **********"],
  dropSections: () => pnbLayouts.DROP_SECTIONS,
  cleanText: pnbLayouts.cleanText,
  getStatementDate: pnbLayouts.getStatementDate,
  getStatementPeriod: pnbLayouts.getStatementPeriod,
  getOpeningBalance: pnbLayouts.getOpeningBalance,
  getClosingBalance: pnbLayouts.getClosingBalance,
};
