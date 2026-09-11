use chrono::NaiveDate;
use regex::Regex;
use std::sync::LazyLock;

use crate::banks::helpers::{
    amounts_with_positions, find_label, parse_date_string, summary_table_row,
};
use crate::period::approx_start_from_end;

static STATEMENT_DATE_SPLIT: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"Statement\s*\n\s*Date\s*:").expect("statement date split"));
static STACKED_OPENING_BALANCE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"Account Summary[\s\S]{0,240}?Opening\s*\n\s*Balance\b").expect("stacked opening")
});

pub fn is_hdfc_v2(text: &str) -> bool {
    if text.to_uppercase().contains("DUPLICATE STATEMENT") {
        return true;
    }
    if STATEMENT_DATE_SPLIT.is_match(text) {
        return true;
    }
    STACKED_OPENING_BALANCE.is_match(text)
}

fn account_summary_row_amounts(text: &str) -> Option<Vec<String>> {
    let m = find_label(text, "Account Summary")?;
    for line in text[m.end()..text.len().min(m.end() + 1200)].lines() {
        let stripped = line.trim();
        if stripped.is_empty() {
            continue;
        }
        let amounts = amounts_with_positions(stripped, false);
        if amounts.len() >= 3 {
            return Some(amounts.into_iter().map(|(a, _)| a).collect());
        }
    }
    None
}

pub fn account_summary_opening(text: &str) -> Option<String> {
    if let Some(amounts) = account_summary_row_amounts(text) {
        return amounts.first().cloned();
    }
    summary_table_row(text, "Account Summary", 1, "opening")
}

pub fn account_summary_total_dues(text: &str) -> Option<String> {
    if let Some(amounts) = account_summary_row_amounts(text) {
        return amounts.last().cloned();
    }
    summary_table_row(text, "Account Summary", 1, "closing")
}

pub fn payment_due_total_dues(text: &str) -> Option<String> {
    let m = find_label(text, "Payment Due Date")?;
    for line in text[m.end()..text.len().min(m.end() + 400)].lines() {
        let stripped = line.trim();
        if stripped.is_empty() {
            continue;
        }
        if parse_date_string(stripped).is_none() {
            continue;
        }
        let amounts = amounts_with_positions(stripped, false);
        if amounts.len() >= 2 {
            return Some(amounts[0].0.clone());
        }
    }
    None
}

pub fn approximate_period_if_needed(
    period_start: Option<NaiveDate>,
    period_end: Option<NaiveDate>,
) -> (Option<NaiveDate>, Option<NaiveDate>) {
    if period_start.is_some() && period_end.is_some() {
        return (period_start, period_end);
    }
    if let Some(end) = period_end {
        return (Some(approx_start_from_end(end)), Some(end));
    }
    (None, None)
}

fn previous_statement_dues_opening(text: &str) -> Option<String> {
    let m = find_label(text, "PREVIOUS STATEMENT DUES")?;
    for line in text[m.end()..text.len().min(m.end() + 600)].lines() {
        let stripped = line.trim();
        if stripped.is_empty() {
            continue;
        }
        let amounts = amounts_with_positions(stripped, false);
        if amounts.len() >= 3 {
            return Some(amounts[0].0.clone());
        }
    }
    None
}

fn modern_total_amount_due(text: &str) -> Option<String> {
    let m = find_label(text, "TOTAL AMOUNT DUE")?;
    let prefix = &text[m.start().saturating_sub(40)..m.start()];
    static PREFIX_GUARD: LazyLock<Regex> = LazyLock::new(|| {
        Regex::new(r"(?i)(?:than|the|less)\s+['\x22]?\s*$").expect("prefix guard")
    });
    if PREFIX_GUARD.is_match(prefix) {
        return None;
    }
    for line in text[m.end()..text.len().min(m.end() + 400)].lines() {
        let stripped = line.trim();
        if stripped.is_empty() {
            continue;
        }
        let amounts = amounts_with_positions(stripped, false);
        if let Some((amount, _)) = amounts.first() {
            return Some(amount.clone());
        }
    }
    None
}

pub fn detect_swiggy_layout(text: &str) -> bool {
    if is_hdfc_v2(text) {
        return true;
    }
    let upper = text.to_uppercase();
    if find_label(text, "Billing Period").is_some() {
        return false;
    }
    if find_label(text, "PREVIOUS STATEMENT DUES").is_some() {
        return false;
    }
    if find_label(text, "TOTAL AMOUNT DUE").is_some() {
        return false;
    }
    upper.contains("ACCOUNT SUMMARY")
}

pub fn swiggy_opening_balance(text: &str) -> Option<String> {
    if detect_swiggy_layout(text) {
        return account_summary_opening(text);
    }
    previous_statement_dues_opening(text)
}

pub fn swiggy_closing_balance(text: &str) -> Option<String> {
    if detect_swiggy_layout(text) {
        return account_summary_total_dues(text).or_else(|| payment_due_total_dues(text));
    }
    modern_total_amount_due(text)
}
