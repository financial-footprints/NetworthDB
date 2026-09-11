use chrono::NaiveDate;
use regex::Regex;
use std::sync::LazyLock;

use super::base::{BankHandler, CreditCardHandler};
use crate::banks::helpers::{
    date_after_label, label_next_line_amount, label_range_end, label_range_period,
    purge_drop_sections, sanitize_statement_text, summary_table_column, trim_by_markers,
};

const ICICI_DROP_SECTIONS: &[&str] = &[
    "For exclusive",
    "offers, visit",
    "IMPORTANT MESSAGES",
    "Download the iMobile Pay app",
    "CREDIT CARD STATEMENT",
    "GREAT    OFFERS    ON   YOUR   CARD",
    "IMPORTANT     INFORMATION      ON  YOUR   CREDIT   CARD",
    "ICICl Bank Rewards",
    "SPENDS OVERVIEW",
    "# International Spends",
    "Others-100%",
    "www.icicibank.com/offers",
    "For any query, you may write to us on customer.care",
    "T&C apply",
];

const STATEMENT_PERIOD_LABELS: &[&str] = &[
    "Statement period :",
    "Statement Period:",
    "Statement Period",
];

static SPENDS_OVERVIEW_PHRASE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i)SPENDS\s+OVERVIEW").expect("spends overview"));

pub struct IciciDefaultHandler;

impl BankHandler for IciciDefaultHandler {
    fn mail_subjects(&self) -> Vec<String> {
        vec!["ICICI Bank Credit Card Statement for the period".to_string()]
    }

    fn year_display(&self) -> &'static str {
        "fiscal_year"
    }

    fn trim_end(&self) -> Vec<&'static str> {
        vec!["MOST IMPORTANT TERMS AND CONDITIONS (MITC)"]
    }

    fn drop_sections(&self) -> Vec<&'static str> {
        ICICI_DROP_SECTIONS.to_vec()
    }

    fn get_statement_date(&self, text: &str) -> Option<NaiveDate> {
        if let Some(parsed) = date_after_label(text, "STATEMENT DATE") {
            return Some(parsed);
        }
        for label in STATEMENT_PERIOD_LABELS {
            if let Some(end) = label_range_end(text, label, " to ") {
                return Some(end);
            }
        }
        None
    }

    fn get_statement_period(&self, text: &str) -> (Option<NaiveDate>, Option<NaiveDate>) {
        for label in STATEMENT_PERIOD_LABELS {
            let (start, end) = label_range_period(text, label, " to ");
            if start.is_some() && end.is_some() {
                return (start, end);
            }
        }
        CreditCardHandler::default_statement_period(text, self.get_statement_date(text))
    }

    fn get_opening_balance(&self, text: &str) -> Option<String> {
        summary_table_column(text, "Previous Balance", "Previous Balance", 300)
    }

    fn get_closing_balance(&self, text: &str) -> Option<String> {
        label_next_line_amount(text, "Total Amount due")
    }
}

pub struct IciciCoralHandler;
pub struct IciciPlatinumHandler;

impl BankHandler for IciciCoralHandler {
    fn mail_subjects(&self) -> Vec<String> {
        IciciDefaultHandler.mail_subjects()
    }
    fn year_display(&self) -> &'static str {
        IciciDefaultHandler.year_display()
    }
    fn trim_end(&self) -> Vec<&'static str> {
        IciciDefaultHandler.trim_end()
    }
    fn drop_sections(&self) -> Vec<&'static str> {
        IciciDefaultHandler.drop_sections()
    }
    fn get_statement_date(&self, text: &str) -> Option<NaiveDate> {
        IciciDefaultHandler.get_statement_date(text)
    }
    fn get_statement_period(&self, text: &str) -> (Option<NaiveDate>, Option<NaiveDate>) {
        IciciDefaultHandler.get_statement_period(text)
    }
    fn get_opening_balance(&self, text: &str) -> Option<String> {
        IciciDefaultHandler.get_opening_balance(text)
    }
    fn get_closing_balance(&self, text: &str) -> Option<String> {
        IciciDefaultHandler.get_closing_balance(text)
    }
}

impl BankHandler for IciciPlatinumHandler {
    fn mail_subjects(&self) -> Vec<String> {
        IciciDefaultHandler.mail_subjects()
    }
    fn year_display(&self) -> &'static str {
        IciciDefaultHandler.year_display()
    }
    fn trim_end(&self) -> Vec<&'static str> {
        IciciDefaultHandler.trim_end()
    }
    fn drop_sections(&self) -> Vec<&'static str> {
        IciciDefaultHandler.drop_sections()
    }
    fn get_statement_date(&self, text: &str) -> Option<NaiveDate> {
        IciciDefaultHandler.get_statement_date(text)
    }
    fn get_statement_period(&self, text: &str) -> (Option<NaiveDate>, Option<NaiveDate>) {
        IciciDefaultHandler.get_statement_period(text)
    }
    fn get_opening_balance(&self, text: &str) -> Option<String> {
        IciciDefaultHandler.get_opening_balance(text)
    }
    fn get_closing_balance(&self, text: &str) -> Option<String> {
        IciciDefaultHandler.get_closing_balance(text)
    }
}

const SPENDS_OVERVIEW_MARKER: &str = "SPENDS OVERVIEW";

fn earnings_markers_before_spends(raw: &str, earnings_markers: &[&str]) -> bool {
    let spends_idx = match raw.find(SPENDS_OVERVIEW_MARKER) {
        Some(i) => i,
        None => return false,
    };
    earnings_markers
        .iter()
        .any(|marker| raw.find(marker).map(|i| i < spends_idx).unwrap_or(false))
}

pub struct IciciAmazonHandler;

impl BankHandler for IciciAmazonHandler {
    fn mail_subjects(&self) -> Vec<String> {
        vec![
            "Amazon Pay ICICI Bank Credit Card Statement for the period".to_string(),
            "ICICI Bank Credit Card Statement for the period".to_string(),
        ]
    }

    fn year_display(&self) -> &'static str {
        IciciDefaultHandler.year_display()
    }

    fn trim_end(&self) -> Vec<&'static str> {
        vec!["Earnings transfered to", "Amazon Pay balance*"]
    }

    fn drop_sections(&self) -> Vec<&'static str> {
        ICICI_DROP_SECTIONS
            .iter()
            .filter(|s| **s != SPENDS_OVERVIEW_MARKER)
            .chain(["EARNINGS"].iter())
            .copied()
            .collect()
    }

    fn clean_text(&self, raw: &str) -> String {
        let earnings_markers = self.trim_end();
        let trim_end: &[&str] = if !earnings_markers.iter().any(|m| raw.contains(m))
            || earnings_markers_before_spends(raw, &earnings_markers)
        {
            &IciciDefaultHandler.trim_end()
        } else {
            &earnings_markers
        };
        let trimmed = trim_by_markers(raw, &[], trim_end);
        let sanitized = sanitize_statement_text(&trimmed);
        let purged = purge_drop_sections(&sanitized, &self.drop_sections());
        SPENDS_OVERVIEW_PHRASE.replace_all(&purged, "").to_string()
    }

    fn get_statement_date(&self, text: &str) -> Option<NaiveDate> {
        IciciDefaultHandler.get_statement_date(text)
    }

    fn get_statement_period(&self, text: &str) -> (Option<NaiveDate>, Option<NaiveDate>) {
        IciciDefaultHandler.get_statement_period(text)
    }

    fn get_opening_balance(&self, text: &str) -> Option<String> {
        IciciDefaultHandler.get_opening_balance(text)
    }

    fn get_closing_balance(&self, text: &str) -> Option<String> {
        IciciDefaultHandler.get_closing_balance(text)
    }
}
