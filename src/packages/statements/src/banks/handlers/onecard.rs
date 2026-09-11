use chrono::NaiveDate;
use regex::Regex;
use std::sync::LazyLock;

use super::base::{BankHandler, CreditCardHandler};
use crate::banks::helpers::{
    amounts_with_positions, date_after_label, label_next_line_amount, line_remainder_after_label,
    parse_date_string, top_range_period,
};

static STATEMENT_PERIOD: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r"(?i)One(?:Card| Credit Card) Statement\s*\((\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s*-\s*(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s*\)",
    )
    .expect("onecard statement period")
});

pub struct OnecardDefaultHandler;

impl BankHandler for OnecardDefaultHandler {
    fn mail_subjects(&self) -> Vec<String> {
        vec![
            "OneCard Statement".to_string(),
            "One Credit Card Statement".to_string(),
        ]
    }

    fn trim_end(&self) -> Vec<&'static str> {
        vec!["IMPORTANT INFORMATION"]
    }

    fn get_statement_date(&self, text: &str) -> Option<NaiveDate> {
        date_after_label(text, "Statement Date")
    }

    fn get_statement_period(&self, text: &str) -> (Option<NaiveDate>, Option<NaiveDate>) {
        let head = &text[..text.len().min(2000)];
        if let Some(caps) = STATEMENT_PERIOD.captures(head) {
            let period_start = parse_date_string(caps.get(1).map(|c| c.as_str()).unwrap_or(""));
            let period_end = parse_date_string(caps.get(2).map(|c| c.as_str()).unwrap_or(""));
            if period_start.is_some() && period_end.is_some() {
                return (period_start, period_end);
            }
        }
        let (start, end) = top_range_period(text, " - ");
        if start.is_some() && end.is_some() {
            return (start, end);
        }
        let end = self.get_statement_date(text);
        CreditCardHandler::default_statement_period(text, end)
    }

    fn get_opening_balance(&self, text: &str) -> Option<String> {
        let remainder = line_remainder_after_label(text, "Opening Balance")?;
        let currency_amounts = amounts_with_positions(&remainder, true);
        if let Some((amount, _)) = currency_amounts.last() {
            return Some(amount.clone());
        }
        let amounts = amounts_with_positions(&remainder, false);
        amounts.last().map(|(a, _)| a.clone())
    }

    fn get_closing_balance(&self, text: &str) -> Option<String> {
        label_next_line_amount(text, "Total Amount Due")
    }
}
