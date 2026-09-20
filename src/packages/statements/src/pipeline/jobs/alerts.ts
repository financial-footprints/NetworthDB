import type { StatementWarning } from "@ndb/core";

export enum AlertKind {
  TextContainsMissing = "text_contains_missing",
  AmbiguousStatementPeriod = "ambiguous_statement_period",
  PdfOpenFailed = "pdf_open_failed",
}

export type Alert = {
  kind: AlertKind;
  message: string;
  account: string;
  sourceFile: string;
  textContains: string[];
};

export class AlertService {
  private readonly alerts: Alert[] = [];

  emit(alert: Alert): void {
    this.alerts.push(alert);
  }

  toStatementWarnings(): StatementWarning[] {
    return this.alerts.map((alert) => ({
      kind: alert.kind,
      message: alert.message,
      account: alert.account,
      sourceFile: alert.sourceFile,
      textContains: alert.textContains,
    }));
  }
}

export function emitPdfOpenAlert(
  alerts: AlertService,
  account: { bank: string; id: string },
  path: string,
  error: { message: string }
): void {
  alerts.emit({
    kind: AlertKind.PdfOpenFailed,
    message: error.message,
    account: `${account.bank}/${account.id}`,
    sourceFile: path,
    textContains: [],
  });
}
