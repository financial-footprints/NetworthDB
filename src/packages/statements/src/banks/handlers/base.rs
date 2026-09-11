use chrono::NaiveDate;

use crate::banks::helpers::{purge_drop_sections, sanitize_statement_text, trim_by_markers};
use crate::banks::period_source::PeriodSource;
use crate::domain::Account;

pub trait BankHandler: Send + Sync {
    fn mail_subjects(&self) -> Vec<String>;
    fn trim_start(&self) -> Vec<&'static str> {
        vec![]
    }
    fn trim_end(&self) -> Vec<&'static str> {
        vec![]
    }
    fn drop_sections(&self) -> Vec<&'static str> {
        vec![]
    }
    fn clean_text(&self, raw: &str) -> String {
        let trimmed = trim_by_markers(raw, &self.trim_start(), &self.trim_end());
        let sanitized = sanitize_statement_text(&trimmed);
        purge_drop_sections(&sanitized, &self.drop_sections())
    }
    fn get_statement_date(&self, text: &str) -> Option<NaiveDate>;
    fn get_statement_period(&self, text: &str) -> (Option<NaiveDate>, Option<NaiveDate>);
    fn get_opening_balance(&self, text: &str) -> Option<String>;
    fn get_closing_balance(&self, text: &str) -> Option<String>;
    fn account_type(&self) -> &'static str {
        "credit_card"
    }
    fn year_display(&self) -> &'static str {
        "calendar_year"
    }

    fn is_annual_statement(&self, _text: &str) -> bool {
        false
    }

    fn get_annual_period(&self, _text: &str) -> Option<(NaiveDate, NaiveDate)> {
        None
    }

    fn resolve_csv_period_with_source(
        &self,
        _csv_text: &str,
        _filename: &str,
        _account: &Account,
    ) -> (String, PeriodSource) {
        ("unknown-month".to_string(), PeriodSource::Unknown)
    }
}

pub struct CreditCardHandler;

impl CreditCardHandler {
    pub fn default_statement_period(
        _text: &str,
        statement_date: Option<NaiveDate>,
    ) -> (Option<NaiveDate>, Option<NaiveDate>) {
        if let Some(end) = statement_date {
            return (None, Some(end));
        }
        (None, None)
    }
}
