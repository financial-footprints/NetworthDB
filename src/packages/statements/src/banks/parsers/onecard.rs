use chrono::{Datelike, Duration, NaiveDate};
use regex::Regex;
use rust_decimal::Decimal;
use std::sync::LazyLock;

use super::common::{make_transaction, Transaction};
use crate::banks::helpers::parse_date_string;

static STOP_MARKER: &str = "IMPORTANT INFORMATION";
static AMOUNT_ONLY: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^-?[\d,]+\.\d{2}$").expect("amount only"));
static AMOUNT_HEADER: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i)^Amount\s*\(Rs\.\)").expect("amount header"));
static TXN_WITH_AMOUNT: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^([\d,]+\.\d{2})\s+(\d{1,2}\s+[A-Za-z]{3})\s+(.+)$").expect("txn with amount")
});
static TXN_NO_AMOUNT: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^(\d{1,2}\s+[A-Za-z]{3})\s+(.+)$").expect("txn no amount"));
static DAY_MONTH_ONLY: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^\d{1,2}\s+[A-Za-z]{3}$").expect("day month"));
static POINTS_SUFFIX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\s+[\d,]+\.\d{2}$").expect("points suffix"));
static CREDIT_DESC: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)\b(?:repayments?|refunds?|paid\s+(?:with|via)(?:\s+\w+)*\s+points?)\b")
        .expect("credit desc")
});
static STATEMENT_PERIOD: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r"(?i)One(?:Card| Credit Card) Statement\s*\((\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s*-\s*(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s*\)",
    )
    .expect("statement period")
});

fn parse_decimal(value: &str) -> Decimal {
    value.replace(',', "").parse().unwrap_or(Decimal::ZERO)
}

fn is_amount_only(line: &str) -> bool {
    AMOUNT_ONLY.is_match(line.trim())
}

fn is_amount_header(line: &str) -> bool {
    AMOUNT_HEADER.is_match(line.trim())
}

fn is_txn_line(line: &str) -> bool {
    let stripped = line.trim();
    if stripped.is_empty() {
        return false;
    }
    if TXN_WITH_AMOUNT.is_match(stripped) {
        return true;
    }
    TXN_NO_AMOUNT.is_match(stripped)
}

fn txn_has_prefixed_amount(line: &str) -> bool {
    TXN_WITH_AMOUNT.is_match(line.trim())
}

fn statement_period_end(text: &str) -> Option<NaiveDate> {
    let head = &text[..text.len().min(2000)];
    STATEMENT_PERIOD
        .captures(head)
        .and_then(|c| c.get(2))
        .and_then(|m| parse_date_string(m.as_str()))
}

fn infer_txn_year(day_month: &str, period_end: Option<NaiveDate>) -> Option<i32> {
    let period_end = period_end?;
    let parsed = parse_date_string(&format!("{} {}", day_month, period_end.year()));
    let parsed = parsed.unwrap_or(period_end);
    if parsed > period_end + Duration::days(21) {
        Some(period_end.year() - 1)
    } else {
        Some(period_end.year())
    }
}

fn strip_reward_points(description: &str) -> String {
    POINTS_SUFFIX.replace(description, "").trim().to_string()
}

fn is_credit(amount: Decimal, description: &str) -> bool {
    if amount < Decimal::ZERO {
        return true;
    }
    CREDIT_DESC.is_match(description)
}

fn parse_txn_line(
    line: &str,
    period_end: Option<NaiveDate>,
    pending_amounts: &mut Vec<Decimal>,
) -> Option<(NaiveDate, String, Decimal, &'static str)> {
    let stripped = line.trim();
    if let Some(prefixed) = TXN_WITH_AMOUNT.captures(stripped) {
        let amount = parse_decimal(prefixed.get(1).map(|c| c.as_str()).unwrap_or("0"));
        let day_month = prefixed.get(2).map(|c| c.as_str()).unwrap_or("");
        if !DAY_MONTH_ONLY.is_match(day_month) {
            return None;
        }
        let description = prefixed.get(3).map(|c| c.as_str()).unwrap_or("").trim();
        let year = infer_txn_year(day_month, period_end)?;
        let txn_date = parse_date_string(&format!("{} {}", day_month, year))?;
        let direction = if is_credit(amount, description) {
            "CR"
        } else {
            "DR"
        };
        return Some((txn_date, description.to_string(), amount.abs(), direction));
    }

    if let Some(bare) = TXN_NO_AMOUNT.captures(stripped) {
        let day_month = bare.get(1).map(|c| c.as_str()).unwrap_or("");
        if !DAY_MONTH_ONLY.is_match(day_month) {
            return None;
        }
        let description = bare.get(2).map(|c| c.as_str()).unwrap_or("").trim();
        if pending_amounts.is_empty() {
            return None;
        }
        let amount = pending_amounts.remove(0);
        let year = infer_txn_year(day_month, period_end)?;
        let txn_date = parse_date_string(&format!("{} {}", day_month, year))?;
        let description = strip_reward_points(description);
        let direction = if is_credit(amount, &description) {
            "CR"
        } else {
            "DR"
        };
        return Some((txn_date, description, amount.abs(), direction));
    }

    None
}

fn collect_amount_cluster(lines: &[&str], start: usize) -> (Vec<Decimal>, usize) {
    let mut amounts = Vec::new();
    let mut index = start;
    while index < lines.len() && is_amount_only(lines[index]) {
        amounts.push(parse_decimal(lines[index].trim()));
        index += 1;
    }
    (amounts, index)
}

fn cluster_applies(lines: &[&str], index: usize) -> bool {
    let mut next_index = index;
    while next_index < lines.len() && lines[next_index].trim().is_empty() {
        next_index += 1;
    }
    if next_index >= lines.len() {
        return false;
    }
    let next_line = lines[next_index].trim();
    if is_amount_header(next_line) {
        return true;
    }
    is_txn_line(next_line) && !txn_has_prefixed_amount(next_line)
}

pub struct OnecardStatementParser;

impl OnecardStatementParser {
    pub fn parse(text: &str, source_file: &str) -> Vec<Transaction> {
        let period_end = statement_period_end(text);
        let lines: Vec<&str> = text.lines().collect();
        let mut rows = Vec::new();
        let mut pending_amounts: Vec<Decimal> = Vec::new();
        let mut index = 0usize;

        while index < lines.len() {
            let line = lines[index];
            if line.contains(STOP_MARKER) {
                break;
            }

            let stripped = line.trim();
            if stripped.is_empty() {
                index += 1;
                continue;
            }

            if is_amount_only(stripped) {
                let (cluster, next_index) = collect_amount_cluster(&lines, index);
                if cluster_applies(&lines, next_index) {
                    pending_amounts.extend(cluster);
                }
                index = next_index;
                continue;
            }

            if is_amount_header(stripped) {
                index += 1;
                continue;
            }

            if is_txn_line(stripped) {
                if let Some((txn_date, description, amount, direction)) =
                    parse_txn_line(stripped, period_end, &mut pending_amounts)
                {
                    rows.push(make_transaction(
                        txn_date,
                        description,
                        amount,
                        direction,
                        source_file,
                        None,
                    ));
                }
                index += 1;
                continue;
            }

            index += 1;
        }

        rows
    }
}
