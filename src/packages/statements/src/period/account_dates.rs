//! Account date helpers for incremental mail fetch (NetworthCSV `account_dates` port).

use chrono::{Datelike, NaiveDate, Utc};

use crate::domain::Account;

fn parse_account_date_field(value: &str) -> Option<NaiveDate> {
    let value = value.trim();
    if value.is_empty() {
        return None;
    }
    if let Ok(d) = NaiveDate::parse_from_str(value, "%d-%m-%Y") {
        return Some(d);
    }
    NaiveDate::parse_from_str(value, "%Y-%m-%d").ok()
}

pub fn parse_opening_date(value: &str) -> Option<NaiveDate> {
    parse_account_date_field(value)
}

pub fn parse_closing_date(value: &str) -> Option<NaiveDate> {
    parse_account_date_field(value)
}

pub fn utc_today() -> NaiveDate {
    Utc::now().date_naive()
}

pub fn format_account_date(value: NaiveDate) -> String {
    format!(
        "{:02}-{:02}-{:04}",
        value.day(),
        value.month(),
        value.year()
    )
}

pub fn parse_account_date_str(value: &str) -> Option<NaiveDate> {
    parse_opening_date(value).or_else(|| parse_closing_date(value))
}

pub fn exclusive_search_end_date(end_date: NaiveDate) -> NaiveDate {
    end_date + chrono::Duration::days(1)
}

pub fn incremental_fetch_start(last_fetch_date: Option<NaiveDate>) -> Option<NaiveDate> {
    last_fetch_date.map(|d| d - chrono::Duration::days(1))
}

pub fn resolve_account_search_dates(
    account: &Account,
    last_fetch_date: Option<NaiveDate>,
) -> (Option<NaiveDate>, Option<NaiveDate>) {
    let opening = parse_opening_date(&account.opening_date);
    let mut start_candidates = vec![];
    if let Some(opening) = opening {
        start_candidates.push(opening);
    }
    if let Some(incremental) = incremental_fetch_start(last_fetch_date) {
        start_candidates.push(incremental);
    }
    let effective_start = start_candidates.into_iter().max();
    let effective_end = account
        .closing_date
        .as_deref()
        .and_then(parse_closing_date)
        .map(exclusive_search_end_date);
    (effective_start, effective_end)
}
