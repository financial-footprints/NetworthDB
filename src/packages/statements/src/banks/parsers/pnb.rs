use regex::Regex;
use rust_decimal::Decimal;
use std::sync::LazyLock;

use super::common::{make_transaction, Transaction};
use crate::banks::helpers::parse_date_string;

static LINE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^(\d{1,2}-[A-Za-z]{3}-\d{4})\s+(\d{1,2}-[A-Za-z]{3}-\d{4})\s+(.+)$")
        .expect("pnb line")
});
static AMOUNT_TAIL: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"([\d,]+\.\d{2})\s*(Cr|Dr|CR|DR)?\s*$").expect("amount tail"));

pub struct PnbStatementParser;

impl PnbStatementParser {
    pub fn parse(text: &str, source_file: &str) -> Vec<Transaction> {
        let mut rows = Vec::new();
        for raw in text.lines() {
            let stripped = raw.trim();
            if stripped.to_uppercase().starts_with("TOTAL") {
                continue;
            }
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
            let rest = caps.get(3).map(|c| c.as_str().trim()).unwrap_or("");
            let amt_caps = AMOUNT_TAIL.captures(rest);
            if amt_caps.is_none() {
                continue;
            }
            let amt_caps = amt_caps.unwrap();
            let amount: Decimal = amt_caps
                .get(1)
                .map(|c| c.as_str().replace(',', ""))
                .unwrap_or_default()
                .parse()
                .unwrap_or(Decimal::ZERO);
            let raw_dir = amt_caps.get(2).map(|m| m.as_str());
            let amount_match = AMOUNT_TAIL.find(rest).unwrap();
            let direction = if raw_dir
                .map(|d| d.to_uppercase().starts_with('C'))
                .unwrap_or(false)
            {
                "CR"
            } else {
                "DR"
            };
            let description = rest[..amount_match.start()].trim();
            if description.is_empty() {
                continue;
            }
            rows.push(make_transaction(
                txn_date,
                description.to_string(),
                amount,
                direction,
                source_file,
                None,
            ));
        }
        rows
    }
}
