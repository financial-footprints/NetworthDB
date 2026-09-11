use chrono::NaiveDate;
use regex::Regex;
use rust_decimal::Decimal;
use std::sync::LazyLock;

use super::common::{make_transaction, Transaction};
use crate::banks::helpers::parse_date_string;

static TXT_LINE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^(\d{1,2}/\d{1,2}/\d{4})\s+(\d+)\s+(.+?)\s+([\d,]+\.\d{2})\s*(CR|DR)?\s*$")
        .expect("icici txt line")
});
static REWARD_SUFFIX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\s+\d+\s*$").expect("reward suffix"));

const TXN_HEADER: &str = "Transaction Details:";
const MESSAGE_HEADER: &str = "MESSAGE Details:";

struct IciciCsvRow {
    date: NaiveDate,
    description: String,
    amount: Decimal,
    ref_no: Option<String>,
}

fn parse_amount(raw: &str) -> Option<Decimal> {
    let cleaned = raw.trim().replace([',', '"'], "");
    if cleaned.is_empty() {
        return None;
    }
    cleaned.parse().ok()
}

fn parse_icici_csv_rows(csv_text: &str) -> Vec<IciciCsvRow> {
    let lines = csv_text.lines().collect::<Vec<_>>();
    let mut start_idx: Option<usize> = None;
    let mut end_idx = lines.len();
    for (index, line) in lines.iter().enumerate() {
        let stripped = line.trim().trim_matches('"');
        if stripped.starts_with(TXN_HEADER) {
            start_idx = Some(index + 1);
        }
        if stripped.starts_with(MESSAGE_HEADER) {
            end_idx = index;
            break;
        }
    }
    let start_idx = match start_idx {
        Some(i) => i,
        None => return vec![],
    };

    let mut rows = Vec::new();
    let mut header_seen = false;
    for line in &lines[start_idx..end_idx] {
        let fields = parse_csv_line(line);
        if fields.is_empty() || !fields.iter().any(|f| !f.trim().is_empty()) {
            continue;
        }
        if !header_seen {
            if fields[0].trim().eq_ignore_ascii_case("date") {
                header_seen = true;
            }
            continue;
        }
        let txn_date = parse_date_string(&fields[0]);
        if txn_date.is_none() {
            continue;
        }
        let txn_date = txn_date.unwrap();
        let description = if fields.len() > 2 {
            fields[2].trim().to_string()
        } else {
            String::new()
        };
        let amount_raw = if fields.len() > 6 && !fields[6].trim().is_empty() {
            &fields[6]
        } else if fields.len() > 5 {
            &fields[5]
        } else {
            ""
        };
        let amount = parse_amount(amount_raw);
        if amount.is_none() {
            continue;
        }
        let amount = amount.unwrap();
        let ref_no = if fields.len() > 1 {
            let candidate = fields[1].trim();
            if !candidate.is_empty()
                && !(candidate.chars().all(|c| c.is_ascii_digit()) && candidate.len() <= 3)
            {
                Some(candidate.to_string())
            } else {
                None
            }
        } else {
            None
        };
        rows.push(IciciCsvRow {
            date: txn_date,
            description,
            amount,
            ref_no,
        });
    }
    rows
}

fn parse_csv_line(line: &str) -> Vec<String> {
    let mut fields = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    for ch in line.chars() {
        match ch {
            '"' => in_quotes = !in_quotes,
            ',' if !in_quotes => {
                fields.push(current.clone());
                current.clear();
            }
            _ => current.push(ch),
        }
    }
    fields.push(current);
    fields
}

fn icici_csv_rows_to_transactions(rows: &[IciciCsvRow], source_file: &str) -> Vec<Transaction> {
    rows.iter()
        .map(|row| {
            let (credited, debited) = if row.amount < Decimal::ZERO {
                (row.amount.abs(), Decimal::ZERO)
            } else {
                (Decimal::ZERO, row.amount)
            };
            Transaction {
                date: row.date,
                description: row.description.clone(),
                credited,
                debited,
                source_file: source_file.to_string(),
                ref_no: row.ref_no.clone(),
            }
        })
        .collect()
}

fn parse_icici_txt(text: &str, source_file: &str) -> Vec<Transaction> {
    let mut rows = Vec::new();
    for raw in text.lines() {
        let stripped = raw.trim();
        let caps = TXT_LINE.captures(stripped);
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
        description = REWARD_SUFFIX.replace(&description, "").trim().to_string();
        if description.is_empty() {
            continue;
        }
        let amount: Decimal = caps
            .get(4)
            .map(|c| c.as_str().replace(',', ""))
            .unwrap_or_default()
            .parse()
            .unwrap_or(Decimal::ZERO);
        let direction = if caps.get(5).map(|c| c.as_str().to_uppercase()).as_deref() == Some("CR") {
            "CR"
        } else {
            "DR"
        };
        rows.push(make_transaction(
            txn_date,
            description,
            amount,
            direction,
            source_file,
            ref_no,
        ));
    }
    rows
}

pub struct IciciStatementParser;

impl IciciStatementParser {
    pub fn parse(text: &str, source_file: &str) -> Vec<Transaction> {
        if text.contains(TXN_HEADER) {
            let rows = parse_icici_csv_rows(text);
            return icici_csv_rows_to_transactions(&rows, source_file);
        }
        parse_icici_txt(text, source_file)
    }
}
