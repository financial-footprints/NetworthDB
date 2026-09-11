use regex::Regex;
use rust_decimal::Decimal;
use std::sync::LazyLock;

use super::common::{make_transaction, Transaction};
use crate::banks::helpers::parse_date_string;

static LINE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^(\d{1,2}/\d{1,2}/\d{4})\s+(\S+)\s+(.+)\s+([\d,]+\.\d{2})\s+(DR|CR)\s*$")
        .expect("bob line")
});
static INR_TAIL: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i)\s+\d+\s+INR\s+[\d,]+\.\d{2}\s*$").expect("inr tail 1"));
static INR_TAIL2: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i)\s+INR\s+[\d,]+\.\d{2}\s*$").expect("inr tail 2"));

pub struct BobStatementParser;

impl BobStatementParser {
    pub fn parse(text: &str, source_file: &str) -> Vec<Transaction> {
        let mut rows = Vec::new();
        for raw in text.lines() {
            let stripped = raw.trim();
            let caps = LINE.captures(stripped);
            if caps.is_none() {
                continue;
            }
            let caps = caps.unwrap();
            let txn_date = parse_date_string(caps.get(1).map(|c| c.as_str()).unwrap_or(""));
            if txn_date.is_none() {
                continue;
            }
            let txn_date = txn_date.unwrap();
            let ref_no = caps.get(2).map(|c| c.as_str().trim().to_string());
            let mut description = caps
                .get(3)
                .map(|c| c.as_str().trim().to_string())
                .unwrap_or_default();
            description = INR_TAIL.replace(&description, "").trim().to_string();
            description = INR_TAIL2.replace(&description, "").trim().to_string();
            let amount: Decimal = caps
                .get(4)
                .map(|c| c.as_str().replace(',', ""))
                .unwrap_or_default()
                .parse()
                .unwrap_or(Decimal::ZERO);
            let direction = caps
                .get(5)
                .map(|c| c.as_str().to_uppercase())
                .unwrap_or_default();
            rows.push(make_transaction(
                txn_date,
                description,
                amount,
                &direction,
                source_file,
                ref_no,
            ));
        }
        rows
    }
}
