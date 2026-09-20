import { CreditCardHandler } from "@statements/banks/handlers/base";
import {
  contextRangeEnd,
  contextRangePeriod,
  firstNotNone,
  labelRangeEnd,
  labelRangePeriod,
  labelSingleDateEnd,
  topRangeEnd,
  topRangePeriodWithChars,
} from "@statements/banks/helpers/index";

export function contextRangeStatementDate(
  text: string,
  context: string,
  joiner: string
): Date | null {
  return contextRangeEnd(text, context, joiner);
}

export function contextRangeStatementPeriod(
  text: string,
  context: string,
  joiner: string
): [Date | null, Date | null] {
  const [start, end] = contextRangePeriod(text, context, joiner);
  if (start && end) {
    return [start, end];
  }
  const statementDate = contextRangeStatementDate(text, context, joiner);
  return CreditCardHandler.defaultStatementPeriod(text, statementDate);
}

export function topRangeStatementDate(
  text: string,
  joiner: string,
  searchChars: number
): Date | null {
  return topRangeEnd(text, joiner, searchChars);
}

export function topRangeStatementPeriod(
  text: string,
  joiner: string,
  searchChars: number
): [Date | null, Date | null] {
  const [start, end] = topRangePeriodWithChars(text, joiner, searchChars);
  if (start && end) {
    return [start, end];
  }
  const statementDate = topRangeStatementDate(text, joiner, searchChars);
  return CreditCardHandler.defaultStatementPeriod(text, statementDate);
}

export function bobStatementDate(text: string): Date | null {
  return firstNotNone([
    labelSingleDateEnd(text, "Statement Date :"),
    labelRangeEnd(text, "Statement Period :", " to "),
    topRangeEnd(text, " To ", 500),
  ]);
}

export function bobStatementPeriod(text: string): [Date | null, Date | null] {
  let [start, end] = labelRangePeriod(text, "Statement Period :", " to ");
  if (start && end) {
    return [start, end];
  }
  [start, end] = topRangePeriodWithChars(text, " To ", 500);
  if (start && end) {
    return [start, end];
  }
  const statementDate = bobStatementDate(text);
  return CreditCardHandler.defaultStatementPeriod(text, statementDate);
}
