import { CreditCardHandler, createBankHandler } from "@statements/banks/handlers/base";
import {
  firstNotNone,
  labelRangePeriod,
  labelSingleDateEnd,
  topRangeEnd,
  topRangePeriodWithChars,
} from "@statements/banks/helpers/index";
import {
  normalizeCrDrLayout,
  wowClosingBalance,
  wowOpeningBalance,
} from "@statements/banks/institutions/idfc/wow/summary-balances";

export const IdfcWowHandler = createBankHandler({
  mailSubjects: () => [
    "FIRST WOW! Credit Card Statement",
    "FIRST WOW Credit Card Statement",
    "Your Credit Card Statement",
  ],
  trimEnd: () => ["IMPORTANT INFORMATION"],
  dropSections: () => [
    "Payment Modes",
    "PAYMENT MODES",
    "Pay via our new Mobile App",
    "Need help Check out our FAQs",
    "Pay Now        Pay in EMI",
    "3X rewards on UPI",
    "Refer this Credit Card",
    "CHECK OUT WHY",
    "Covert your IDFC FIRST Bank Credit Card",
    "Late payment fee would be levied if Minimum",
    "SPECIAL BENEFITS ON YOUR CARD",
    "OFFER OF THE MONTH",
    "YOU MADE A GREAT CHOICE",
    "Enjoy the Convenience",
    "Your Card Information",
  ],
  getStatementDate: (text: string) =>
    firstNotNone([labelSingleDateEnd(text, "Statement Date"), topRangeEnd(text, " - ", 500)]),
  getStatementPeriod(text) {
    let [start, end] = labelRangePeriod(text, "Statement Date", " to ");
    if (start && end) {
      return [start, end];
    }
    [start, end] = topRangePeriodWithChars(text, " - ", 500);
    if (start && end) {
      return [start, end];
    }
    [start, end] = labelRangePeriod(text, "Statement Period", " - ");
    if (start && end) {
      return [start, end];
    }
    return CreditCardHandler.defaultStatementPeriod(text, this.getStatementDate(text));
  },
  getOpeningBalance(text) {
    return wowOpeningBalance(normalizeCrDrLayout(text));
  },
  getClosingBalance(text) {
    return wowClosingBalance(normalizeCrDrLayout(text));
  },
});
