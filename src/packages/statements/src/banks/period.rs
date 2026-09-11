//! Bank-delegated statement period resolution (NetworthCSV `utils/banks/period` port).

use std::sync::Arc;

use crate::banks::handlers::get_handler;
use crate::banks::handlers::BankHandler;
use crate::domain::Account;
use crate::errors::StageError;
use crate::period::{fy_key_from_dates, month_period_from_filename};
use chrono::Datelike;

pub use crate::banks::period_source::{period_source_for_path, period_source_rank, PeriodSource};

fn annual_period_with_source(
    handler: &Arc<dyn BankHandler>,
    text: &str,
) -> Option<(String, PeriodSource)> {
    if !handler.is_annual_statement(text) {
        return None;
    }
    let period = handler.get_annual_period(text)?;
    Some((fy_key_from_dates(period.0, period.1), PeriodSource::Annual))
}

fn resolve_monthly_period_with_source(
    handler: &Arc<dyn BankHandler>,
    text: &str,
    filename: &str,
) -> (String, PeriodSource) {
    if let Some(parsed) = handler.get_statement_date(text) {
        return (
            format!("{:04}-{:02}", parsed.year(), parsed.month()),
            PeriodSource::ContentDate,
        );
    }
    let fallback = month_period_from_filename(filename);
    if fallback != "unknown-month" {
        return (fallback, PeriodSource::FilenameFallback);
    }
    ("unknown-month".to_string(), PeriodSource::Unknown)
}

pub fn resolve_period_key_with_source(
    text: &str,
    filename: &str,
    account: &Account,
) -> Result<(String, PeriodSource), StageError> {
    let handler = get_handler(&account.bank, account.variant.as_deref())?;
    if handler.is_annual_statement(text) {
        if let Some(annual) = annual_period_with_source(&handler, text) {
            return Ok(annual);
        }
        return Ok(("unknown-month".to_string(), PeriodSource::Unknown));
    }
    Ok(resolve_monthly_period_with_source(&handler, text, filename))
}

pub fn resolve_key_with_source(
    csv_text: &str,
    filename: &str,
    account: &Account,
) -> Result<(String, PeriodSource), StageError> {
    let handler = get_handler(&account.bank, account.variant.as_deref())?;
    let (period, source) = handler.resolve_csv_period_with_source(csv_text, filename, account);
    if source != PeriodSource::Unknown {
        return Ok((period, source));
    }
    resolve_period_key_with_source(csv_text, filename, account)
}
