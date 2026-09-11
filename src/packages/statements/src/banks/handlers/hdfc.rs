use chrono::{Datelike, NaiveDate};
use regex::Regex;
use std::sync::LazyLock;

use super::base::BankHandler;
use super::hdfc_layouts::{
    account_summary_opening, account_summary_total_dues, approximate_period_if_needed, is_hdfc_v2,
    payment_due_total_dues, swiggy_closing_balance, swiggy_opening_balance,
};
use super::mixins::context_range_statement_period;
use crate::banks::helpers::{
    date_after_label, equation_first_after, first_not_none, label_single_date_end,
    single_amount_after, summary_table_column, summary_table_row,
};
use crate::period::parse_month_year_token;

static ANNUAL_PERIOD_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)period from\s+([A-Z]+-\d{2,4})\s+to\s+([A-Z]+-\d{2,4})")
        .expect("annual period")
});

const HDFC_DROP_SECTIONS: &[&str] = &[
    "Benefits on your card",
    "IMPORTANT INFORMATION",
    "Your Card Control Setting",
    "Purchase Indicator / Insights",
    "Offers on your card",
    "Important Information",
    "Useful Links",
    "To update your personal details, please write a letter to",
    "In case you wish to update the personal details",
    "Note : The  Available Credit Limit",
    "If the  Minimum Amount Due",
    "To Hotlist your Credit Card",
    "To Hotlist your credit card",
    "Credit Information Companies",
    "Making only the minimum payment every month",
    "Statement and Payment MITC",
    "with Credit Information Companies",
];

fn detect_annual_statement(text: &str) -> bool {
    let lowered = text.to_lowercase();
    if lowered.contains("year end statement")
        && lowered.contains("account summary for the period from")
    {
        return true;
    }
    if ANNUAL_PERIOD_PATTERN.find(text).is_none() {
        return false;
    }
    lowered.contains("year end statement") || lowered.contains("account summary")
}

fn parse_annual_period(text: &str) -> Option<(NaiveDate, NaiveDate)> {
    let caps = ANNUAL_PERIOD_PATTERN.captures(text)?;
    let start_token = parse_month_year_token(caps.get(1).map(|c| c.as_str()).unwrap_or(""))?;
    let end_token = parse_month_year_token(caps.get(2).map(|c| c.as_str()).unwrap_or(""))?;
    let (start_year, start_month) = start_token;
    let (end_year, end_month) = end_token;
    let end_day = last_day_of_month(end_year, end_month);
    Some((
        NaiveDate::from_ymd_opt(start_year, start_month, 1).unwrap(),
        NaiveDate::from_ymd_opt(end_year, end_month, end_day).unwrap(),
    ))
}

fn last_day_of_month(year: i32, month: u32) -> u32 {
    let next = if month == 12 {
        NaiveDate::from_ymd_opt(year + 1, 1, 1)
    } else {
        NaiveDate::from_ymd_opt(year, month + 1, 1)
    }
    .unwrap();
    next.pred_opt().map(|d| d.day()).unwrap_or(28)
}

fn resolve_hdfc_statement_period(
    handler: &HdfcDefaultHandler,
    text: &str,
) -> (Option<NaiveDate>, Option<NaiveDate>) {
    if detect_annual_statement(text) {
        if let Some((start, end)) = parse_annual_period(text) {
            return (Some(start), Some(end));
        }
    }
    let (start, end) = context_range_statement_period(text, "Billing Period", " - ");
    let (start, end) = approximate_period_if_needed(start, end);
    if start.is_none() || end.is_none() {
        if let Some(statement_date) = handler.get_statement_date(text) {
            return approximate_period_if_needed(start, Some(statement_date));
        }
    }
    (start, end)
}

pub struct HdfcDefaultHandler;

impl BankHandler for HdfcDefaultHandler {
    fn mail_subjects(&self) -> Vec<String> {
        vec!["HDFC Bank Credit Card Statement".to_string()]
    }

    fn trim_end(&self) -> Vec<&'static str> {
        vec!["Reward Points Summary"]
    }

    fn drop_sections(&self) -> Vec<&'static str> {
        HDFC_DROP_SECTIONS.to_vec()
    }

    fn year_display(&self) -> &'static str {
        "fiscal_year"
    }

    fn is_annual_statement(&self, text: &str) -> bool {
        detect_annual_statement(text)
    }

    fn get_annual_period(&self, text: &str) -> Option<(NaiveDate, NaiveDate)> {
        parse_annual_period(text)
    }

    fn get_statement_date(&self, text: &str) -> Option<NaiveDate> {
        if detect_annual_statement(text) {
            if let Some((_, end)) = parse_annual_period(text) {
                return Some(end);
            }
        }
        first_not_none([
            label_single_date_end(text, "Statement Date"),
            date_after_label(text, "Statement Date"),
            date_after_label(text, "Address"),
            super::mixins::context_range_statement_date(text, "Billing Period", " - "),
        ])
    }

    fn get_statement_period(&self, text: &str) -> (Option<NaiveDate>, Option<NaiveDate>) {
        resolve_hdfc_statement_period(self, text)
    }

    fn get_opening_balance(&self, text: &str) -> Option<String> {
        if detect_annual_statement(text) {
            return None;
        }
        if is_hdfc_v2(text) {
            return account_summary_opening(text);
        }
        first_not_none([
            summary_table_column(text, "Account Summary", "Opening Balance", 2000),
            summary_table_row(text, "Account Summary", 1, "opening"),
        ])
    }

    fn get_closing_balance(&self, text: &str) -> Option<String> {
        if detect_annual_statement(text) {
            return None;
        }
        if is_hdfc_v2(text) {
            return account_summary_total_dues(text).or_else(|| payment_due_total_dues(text));
        }
        first_not_none([
            summary_table_column(text, "Account Summary", "Total Dues", 2000),
            summary_table_row(text, "Account Summary", 1, "closing"),
        ])
    }
}

pub struct HdfcRegaliaHandler;
pub struct HdfcRegaliaGoldHandler;
pub struct HdfcDinersHandler;

impl BankHandler for HdfcRegaliaHandler {
    fn mail_subjects(&self) -> Vec<String> {
        vec!["Your HDFC Bank - Regalia MasterCard Credit Card Statement".to_string()]
    }
    fn trim_end(&self) -> Vec<&'static str> {
        HdfcDefaultHandler.trim_end()
    }
    fn drop_sections(&self) -> Vec<&'static str> {
        HdfcDefaultHandler.drop_sections()
    }
    fn year_display(&self) -> &'static str {
        HdfcDefaultHandler.year_display()
    }
    fn get_statement_date(&self, text: &str) -> Option<NaiveDate> {
        HdfcDefaultHandler.get_statement_date(text)
    }
    fn get_statement_period(&self, text: &str) -> (Option<NaiveDate>, Option<NaiveDate>) {
        HdfcDefaultHandler.get_statement_period(text)
    }
    fn get_opening_balance(&self, text: &str) -> Option<String> {
        HdfcDefaultHandler.get_opening_balance(text)
    }
    fn get_closing_balance(&self, text: &str) -> Option<String> {
        HdfcDefaultHandler.get_closing_balance(text)
    }
}

impl BankHandler for HdfcRegaliaGoldHandler {
    fn mail_subjects(&self) -> Vec<String> {
        vec!["Your HDFC Bank - HDFC Bank Regalia Gold Credit Card Statement".to_string()]
    }
    fn trim_end(&self) -> Vec<&'static str> {
        HdfcDefaultHandler.trim_end()
    }
    fn drop_sections(&self) -> Vec<&'static str> {
        HdfcDefaultHandler.drop_sections()
    }
    fn year_display(&self) -> &'static str {
        HdfcDefaultHandler.year_display()
    }
    fn get_statement_date(&self, text: &str) -> Option<NaiveDate> {
        HdfcDefaultHandler.get_statement_date(text)
    }
    fn get_statement_period(&self, text: &str) -> (Option<NaiveDate>, Option<NaiveDate>) {
        HdfcDefaultHandler.get_statement_period(text)
    }
    fn get_opening_balance(&self, text: &str) -> Option<String> {
        HdfcDefaultHandler.get_opening_balance(text)
    }
    fn get_closing_balance(&self, text: &str) -> Option<String> {
        HdfcDefaultHandler.get_closing_balance(text)
    }
}

impl BankHandler for HdfcDinersHandler {
    fn mail_subjects(&self) -> Vec<String> {
        vec!["Your HDFC Bank - Diners Club International Credit Card Statement".to_string()]
    }
    fn trim_end(&self) -> Vec<&'static str> {
        HdfcDefaultHandler.trim_end()
    }
    fn drop_sections(&self) -> Vec<&'static str> {
        HdfcDefaultHandler.drop_sections()
    }
    fn year_display(&self) -> &'static str {
        HdfcDefaultHandler.year_display()
    }
    fn get_statement_date(&self, text: &str) -> Option<NaiveDate> {
        HdfcDefaultHandler.get_statement_date(text)
    }
    fn get_statement_period(&self, text: &str) -> (Option<NaiveDate>, Option<NaiveDate>) {
        HdfcDefaultHandler.get_statement_period(text)
    }
    fn get_opening_balance(&self, text: &str) -> Option<String> {
        HdfcDefaultHandler.get_opening_balance(text)
    }
    fn get_closing_balance(&self, text: &str) -> Option<String> {
        HdfcDefaultHandler.get_closing_balance(text)
    }
}

pub struct HdfcSwiggyHandler;

impl BankHandler for HdfcSwiggyHandler {
    fn mail_subjects(&self) -> Vec<String> {
        vec!["Swiggy HDFC Bank Credit Card Statement".to_string()]
    }
    fn trim_end(&self) -> Vec<&'static str> {
        HdfcDefaultHandler.trim_end()
    }
    fn drop_sections(&self) -> Vec<&'static str> {
        HdfcDefaultHandler.drop_sections()
    }
    fn year_display(&self) -> &'static str {
        HdfcDefaultHandler.year_display()
    }
    fn get_statement_date(&self, text: &str) -> Option<NaiveDate> {
        HdfcDefaultHandler.get_statement_date(text)
    }
    fn get_statement_period(&self, text: &str) -> (Option<NaiveDate>, Option<NaiveDate>) {
        resolve_hdfc_statement_period(&HdfcDefaultHandler, text)
    }
    fn get_opening_balance(&self, text: &str) -> Option<String> {
        swiggy_opening_balance(text)
    }
    fn get_closing_balance(&self, text: &str) -> Option<String> {
        swiggy_closing_balance(text)
    }
}

const TATA_NEU_EXTRA_DROP: &[&str] = &[
    "NeuCoins with Bank Opening NeuCoins",
    "Eligible for EMI",
    "CONVERT TO EMI",
];

pub struct HdfcTataNeuInfinityHandler;

impl BankHandler for HdfcTataNeuInfinityHandler {
    fn mail_subjects(&self) -> Vec<String> {
        vec!["Your HDFC Bank - Tata Neu Infinity HDFC Bank Credit Card Statement".to_string()]
    }
    fn trim_end(&self) -> Vec<&'static str> {
        vec!["Bonus NeuCoins Summary"]
    }
    fn drop_sections(&self) -> Vec<&'static str> {
        HDFC_DROP_SECTIONS
            .iter()
            .chain(TATA_NEU_EXTRA_DROP.iter())
            .copied()
            .collect()
    }
    fn year_display(&self) -> &'static str {
        HdfcDefaultHandler.year_display()
    }
    fn get_statement_date(&self, text: &str) -> Option<NaiveDate> {
        HdfcDefaultHandler.get_statement_date(text)
    }
    fn get_statement_period(&self, text: &str) -> (Option<NaiveDate>, Option<NaiveDate>) {
        HdfcDefaultHandler.get_statement_period(text)
    }
    fn get_opening_balance(&self, text: &str) -> Option<String> {
        if is_hdfc_v2(text) {
            return account_summary_opening(text);
        }
        equation_first_after(text, "PREVIOUS STATEMENT DUES")
    }
    fn get_closing_balance(&self, text: &str) -> Option<String> {
        if is_hdfc_v2(text) {
            return account_summary_total_dues(text).or_else(|| payment_due_total_dues(text));
        }
        single_amount_after(text, "TOTAL AMOUNT DUE")
    }
}
