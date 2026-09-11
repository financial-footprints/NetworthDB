use chrono::NaiveDate;
use regex::Regex;
use rust_decimal::Decimal;
use std::sync::LazyLock;

use super::common::{make_transaction, Transaction};
use crate::banks::helpers::parse_date_string;

static DATE_PREFIX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^(\d{1,2}/(?:\d{1,2}|[A-Za-z]{3})/\d{2,4}|\d{1,2}\s+[A-Za-z]{3}\s+\d{2})\s+")
        .expect("date prefix")
});
static DR_CR_SUFFIX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\s+(DR|CR)\s*$").expect("dr cr suffix"));
static CR_SUFFIX: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\s+CR\s*$").expect("cr suffix"));
static FX_TAIL: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\s+USD\s+[\d,]+\.\d{2}\s*$").expect("fx tail"));
static DECIMAL_AMOUNT: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"[\d,]+\.\d{2}").expect("decimal amount"));

fn parse_transaction_line(line: &str) -> Option<(NaiveDate, String, Decimal, String)> {
    let stripped = line.trim();
    if stripped.is_empty() {
        return None;
    }
    let caps = DATE_PREFIX.captures(stripped)?;
    let txn_date = parse_date_string(caps.get(1).map(|c| c.as_str()).unwrap_or(""))?;
    let mut rest = stripped[caps.get(0).map(|c| c.end()).unwrap_or(0)..]
        .trim()
        .to_string();
    let mut direction = "DR".to_string();

    if let Some(dr_cr) = DR_CR_SUFFIX.find(&rest) {
        direction = dr_cr.as_str().trim().to_uppercase();
        rest = rest[..dr_cr.start()].trim().to_string();
    } else if CR_SUFFIX.is_match(&rest) {
        direction = "CR".to_string();
        rest = CR_SUFFIX.replace(&rest, "").trim().to_string();
    }

    let amount_matches: Vec<_> = DECIMAL_AMOUNT.find_iter(&rest).collect();
    if amount_matches.is_empty() {
        return None;
    }
    let last = amount_matches.last().unwrap();
    let amount: Decimal = last
        .as_str()
        .replace(',', "")
        .parse()
        .unwrap_or(Decimal::ZERO);
    let description = FX_TAIL
        .replace(rest[..last.start()].trim(), "")
        .trim()
        .to_string();
    if description.is_empty() {
        return None;
    }
    Some((txn_date, description, amount, direction))
}

pub struct IdfcWowStatementParser;

impl IdfcWowStatementParser {
    pub fn parse(text: &str, source_file: &str) -> Vec<Transaction> {
        let mut rows = Vec::new();
        for line in text.lines() {
            if let Some((txn_date, description, amount, direction)) = parse_transaction_line(line) {
                rows.push(make_transaction(
                    txn_date,
                    description,
                    amount,
                    &direction,
                    source_file,
                    None,
                ));
            }
        }
        rows
    }
}
