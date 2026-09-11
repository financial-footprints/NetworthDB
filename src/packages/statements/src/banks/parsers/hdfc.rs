use chrono::NaiveDate;
use regex::Regex;
use rust_decimal::Decimal;
use std::collections::HashSet;
use std::sync::LazyLock;

use super::common::{make_transaction, Transaction};
use crate::banks::helpers::parse_date_string;

static ANNUAL_LINE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^(\d{1,2}-[A-Za-z]{3}-\d{4})\s+(.+?)\s+([\d,]+\.\d{2})\s+(DR|CR)\b")
        .expect("annual line")
});
static MONTHLY_LINE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r"^\s*(\d{1,2}/\d{1,2}/\d{4})(?:\s+\d{1,2}:\d{2}:\d{2})?\s+(.+?)\s+([\d,]+\.\d{2})\s*(Cr|CR|Dr|DR)?\s*$",
    )
    .expect("monthly line")
});

fn direction_from_suffix(raw: Option<&str>) -> String {
    match raw {
        Some(r) if r.to_uppercase().starts_with('C') => "CR".to_string(),
        _ => "DR".to_string(),
    }
}

pub struct HdfcStatementParser;

impl HdfcStatementParser {
    pub fn parse(text: &str, source_file: &str) -> Vec<Transaction> {
        let mut rows = Vec::new();
        let mut seen: HashSet<(NaiveDate, String, Decimal, String)> = HashSet::new();

        for caps in ANNUAL_LINE.captures_iter(text) {
            let txn_date = parse_date_string(caps.get(1).map(|c| c.as_str()).unwrap_or(""));
            if txn_date.is_none() {
                continue;
            }
            let txn_date = txn_date.unwrap();
            let description = caps
                .get(2)
                .map(|c| c.as_str().trim().to_string())
                .unwrap_or_default();
            let amount: Decimal = caps
                .get(3)
                .map(|c| c.as_str().replace(',', ""))
                .unwrap_or_default()
                .parse()
                .unwrap_or(Decimal::ZERO);
            let direction = caps
                .get(4)
                .map(|c| c.as_str().to_uppercase())
                .unwrap_or_default();
            let key = (txn_date, description.clone(), amount, direction.clone());
            if seen.contains(&key) {
                continue;
            }
            seen.insert(key);
            rows.push(make_transaction(
                txn_date,
                description,
                amount,
                &direction,
                source_file,
                None,
            ));
        }

        for caps in MONTHLY_LINE.captures_iter(text) {
            let txn_date = parse_date_string(caps.get(1).map(|c| c.as_str()).unwrap_or(""));
            if txn_date.is_none() {
                continue;
            }
            let txn_date = txn_date.unwrap();
            let description = caps
                .get(2)
                .map(|c| c.as_str().trim().to_string())
                .unwrap_or_default();
            if description.is_empty() {
                continue;
            }
            let amount: Decimal = caps
                .get(3)
                .map(|c| c.as_str().replace(',', ""))
                .unwrap_or_default()
                .parse()
                .unwrap_or(Decimal::ZERO);
            let direction = direction_from_suffix(caps.get(4).map(|c| c.as_str()));
            let key = (txn_date, description.clone(), amount, direction.clone());
            if seen.contains(&key) {
                continue;
            }
            seen.insert(key);
            rows.push(make_transaction(
                txn_date,
                description,
                amount,
                &direction,
                source_file,
                None,
            ));
        }

        rows
    }
}
