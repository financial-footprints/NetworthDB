import {
  firstNotNone,
  labelNextLineAmount,
  labelSingleDateEnd,
} from "@statements/banks/helpers/index";
import {
  contextRangeStatementDate,
  contextRangeStatementPeriod,
} from "@statements/banks/shared/mixins";

export const YES_DROP_SECTIONS = [
  "Your Reward Points Summary",
  "To redeem your Reward Points",
  "Important information :",
  "Important Information:",
  "Presenting EMI facility through e-Statements",
  "SMS  Help  space",
  "Important Safety Instructions",
  "Dear Cardmember,",
  "Making only the minimum payment every month",
  "from a wide range of options, please visit",
  "Simply click on the highlighted transactions",
  "YES TOUCH PhoneBanking Number",
  "At YES BANK, maintaining confidentiality",
  "Please click here for the Most Important Terms and Conditions",
  "YES BANK Credit Cards GSTIN",
  "Basis RBI circular on",
];

export const yesSharedHandlerConfig = {
  trimEnd: () => ["------------------End of the Statement------------------"],
  dropSections: () => YES_DROP_SECTIONS,
  getStatementDate: (text: string) =>
    firstNotNone([
      labelSingleDateEnd(text, "Statement Date :"),
      contextRangeStatementDate(text, "Statement Period", " To "),
    ]),
  getStatementPeriod: (text: string) =>
    contextRangeStatementPeriod(text, "Statement Period", " To "),
  getOpeningBalance: (text: string) => labelNextLineAmount(text, "Previous Balance :"),
  getClosingBalance: (text: string) => labelNextLineAmount(text, "Total Amount Due:"),
};
