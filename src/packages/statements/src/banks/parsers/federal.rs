use chrono::NaiveDate;
use regex::Regex;
use rust_decimal::Decimal;
use std::sync::LazyLock;

use super::common::{
    parse_dated_amount_line, parse_dd_mon_rs_dr_cr_line, parse_stop_at_end_lines, Transaction,
};
use crate::banks::helpers::parse_date_string;

static DMY_HYPHEN_DR_CR_LINE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^\s*(\d{1,2}-\d{1,2}-\d{4})\s+(.+?)\s+([\d,]+\.\d{2})\s*(Dr|Cr)\s*$")
        .expect("dmy hyphen dr cr")
});

fn parse_dmy_hyphen_dr_cr_line(line: &str) -> Option<(NaiveDate, String, Decimal, String)> {
    let caps = DMY_HYPHEN_DR_CR_LINE.captures(line.trim())?;
    let txn_date = parse_date_string(caps.get(1).map(|c| c.as_str()).unwrap_or(""))?;
    let description = caps.get(2).map(|c| c.as_str().trim()).unwrap_or("");
    if description.is_empty() {
        return None;
    }
    let amount: Decimal = caps
        .get(3)
        .map(|c| c.as_str().replace(',', ""))
        .unwrap_or_default()
        .parse()
        .unwrap_or(Decimal::ZERO);
    let direction = if caps
        .get(4)
        .map(|c| c.as_str())
        .unwrap_or("")
        .to_uppercase()
        .starts_with('C')
    {
        "CR".to_string()
    } else {
        "DR".to_string()
    };
    Some((txn_date, description.to_string(), amount, direction))
}

pub struct FederalDefaultParser;
pub struct FederalSignetParser;
pub struct FederalEdgeParser;

impl FederalDefaultParser {
    pub fn parse(text: &str, source_file: &str) -> Vec<Transaction> {
        parse_stop_at_end_lines(
            text,
            parse_dated_amount_line,
            source_file,
            "End of Transactions",
        )
    }
}

impl FederalSignetParser {
    pub fn parse(text: &str, source_file: &str) -> Vec<Transaction> {
        parse_stop_at_end_lines(
            text,
            parse_dmy_hyphen_dr_cr_line,
            source_file,
            "End of Transactions",
        )
    }
}

impl FederalEdgeParser {
    pub fn parse(text: &str, source_file: &str) -> Vec<Transaction> {
        parse_stop_at_end_lines(
            text,
            parse_dd_mon_rs_dr_cr_line,
            source_file,
            "End of Transactions",
        )
    }
}
