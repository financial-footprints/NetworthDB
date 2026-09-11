use chrono::NaiveDate;
use regex::Regex;
use rust_decimal::Decimal;
use std::sync::LazyLock;

use crate::banks::helpers::parse_date_string;

#[derive(Debug, Clone, PartialEq)]
pub struct Transaction {
    pub date: NaiveDate,
    pub description: String,
    pub credited: Decimal,
    pub debited: Decimal,
    pub source_file: String,
    pub ref_no: Option<String>,
}

static AMOUNT: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?:Rs\.?\s*)?([\d,]+(?:\.\d{1,2})?)").expect("amount"));
static DR_CR_TOKEN: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\b(DR|CR|Dr|Cr)\b").expect("dr cr token"));
static DD_MON_RS_DR_CR_LINE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r"^\s*(\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4})\s+(.+?)\s+Rs\.?\s*([\d,]+(?:\.\d{1,2})?)\s*(Dr|Cr)\s*$",
    )
    .expect("dd mon rs dr cr")
});
static DATE_PREFIX_SLASH: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^(\d{1,2}/\d{1,2}/\d{2,4})\s+").expect("date slash"));
static DATE_PREFIX_DASH_NUM: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^(\d{1,2}-\d{1,2}-\d{2,4})\s+").expect("date dash num"));
static DATE_PREFIX_DASH_MON: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^(\d{1,2}-[A-Za-z]{3}-\d{2,4})\s+").expect("date dash mon"));
static DATE_PREFIX_SPACE_MON: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^(\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4})\s+").expect("date space mon"));

pub fn credited_debited(amount: Decimal, direction: &str) -> (Decimal, Decimal) {
    if direction.eq_ignore_ascii_case("CR") {
        (amount, Decimal::ZERO)
    } else {
        (Decimal::ZERO, amount)
    }
}

pub fn make_transaction(
    txn_date: NaiveDate,
    description: String,
    amount: Decimal,
    direction: &str,
    source_file: &str,
    ref_no: Option<String>,
) -> Transaction {
    let (credited, debited) = credited_debited(amount, direction);
    Transaction {
        date: txn_date,
        description,
        credited,
        debited,
        source_file: source_file.to_string(),
        ref_no,
    }
}

fn split_direction_suffix(rest: &str) -> (String, String) {
    let matches: Vec<_> = DR_CR_TOKEN.find_iter(rest).collect();
    if matches.is_empty() {
        return (rest.trim().to_string(), "DR".to_string());
    }
    let last = matches.last().unwrap();
    let direction = if last.as_str().to_uppercase().starts_with('C') {
        "CR"
    } else {
        "DR"
    };
    (
        rest[..last.start()].trim().to_string(),
        direction.to_string(),
    )
}

pub fn parse_dated_amount_line(line: &str) -> Option<(NaiveDate, String, Decimal, String)> {
    let stripped = line.trim();
    if stripped.is_empty() {
        return None;
    }

    let caps = DATE_PREFIX_SLASH
        .captures(stripped)
        .or_else(|| DATE_PREFIX_DASH_NUM.captures(stripped))
        .or_else(|| DATE_PREFIX_DASH_MON.captures(stripped))
        .or_else(|| DATE_PREFIX_SPACE_MON.captures(stripped));
    let caps = caps?;
    let txn_date = parse_date_string(caps.get(1).map(|c| c.as_str()).unwrap_or(""))?;
    let rest = stripped[caps.get(0).map(|c| c.end()).unwrap_or(0)..].trim();
    let (rest, direction) = split_direction_suffix(rest);
    let amount_matches: Vec<_> = AMOUNT.find_iter(&rest).collect();
    if amount_matches.is_empty() {
        return None;
    }
    let last = amount_matches.last().unwrap();
    let amount: Decimal = last
        .as_str()
        .replace(',', "")
        .parse()
        .unwrap_or(Decimal::ZERO);
    let description = rest[..last.start()].trim();
    let description = Regex::new(r"(?i)\s*Rs\.?\s*$")
        .expect("rs suffix")
        .replace(description, "")
        .trim()
        .to_string();
    if description.is_empty() {
        return None;
    }
    Some((txn_date, description, amount, direction))
}

pub fn line_has_dr_cr_marker(line: &str) -> bool {
    DR_CR_TOKEN.is_match(line)
}

pub fn parse_dd_mon_rs_dr_cr_line(line: &str) -> Option<(NaiveDate, String, Decimal, String)> {
    let caps = DD_MON_RS_DR_CR_LINE.captures(line.trim())?;
    let txn_date = parse_date_string(caps.get(1).map(|c| c.as_str()).unwrap_or(""))?;
    let description = caps.get(2).map(|c| c.as_str()).unwrap_or("").trim();
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

pub fn parse_stop_at_end_lines<F>(
    text: &str,
    line_parser: F,
    source_file: &str,
    stop_marker: &str,
) -> Vec<Transaction>
where
    F: Fn(&str) -> Option<(NaiveDate, String, Decimal, String)>,
{
    let mut rows = Vec::new();
    for line in text.lines() {
        if line.contains(stop_marker) {
            break;
        }
        if let Some((txn_date, description, amount, direction)) = line_parser(line) {
            let description = description.replace("Rs.", "").trim().to_string();
            if description.is_empty() {
                continue;
            }
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
