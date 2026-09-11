use chrono::NaiveDate;
use regex::Regex;
use std::sync::LazyLock;

use crate::banks::helpers::{
    context_range_end, context_range_period, date_after_label, first_amount_in_text,
    first_not_none, label_regex, label_single_amount, label_single_date_end, parse_date_string,
    purge_drop_sections, sanitize_statement_text, summary_table_column, trim_by_markers,
};

pub const INVOICE_NO_LABEL: &str = "Invoice No :";
pub const V1_INVOICE_NO_MAX_OFFSET: usize = 2500;
pub const V2_INVOICE_NO_MIN_OFFSET: usize = 4000;

pub const MARKETING_MARKERS: &[&str] = &["Presenting Rupay Platinum", "Scan below QR", "PNB GENIE"];

const TRIM_END: &[&str] = &["********** End of Statement **********"];

pub const DROP_SECTIONS: &[&str] = &[
    "*TAD for the month consists of current month purchases",
    "Presenting Rupay Platinum",
    "PNB GENIE",
    "Scan and download",
    "Always get MORE",
    "Reward points details",
    "Why pay in Rupees",
    "CAUTION :",
    "Please make all Cheque",
];

static INVOICE_NUMBER: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\d{4}CC\d+").expect("invoice number"));
static CARD_LINE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\d+X+\d+").expect("card line"));
static AMOUNT_ONLY: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^-?\d[\d,]*(?:\.\d+)?$").expect("amount only"));
static STANDALONE_PERIOD_LINE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(\d{1,2}-[A-Za-z]{3}-\d{4})\s+(\d{1,2}-[A-Za-z]{3}-\d{4})").expect("period line")
});

fn prepare_statement_text(raw: &str, trim_start: &[&str]) -> String {
    let trimmed = trim_by_markers(raw, trim_start, TRIM_END);
    let sanitized = sanitize_statement_text(&trimmed);
    purge_drop_sections(&sanitized, DROP_SECTIONS)
}

fn trim_statement_body(raw: &str, trim_start: &[&str]) -> String {
    trim_by_markers(raw, trim_start, TRIM_END)
}

pub fn detect_layout(text: &str) -> bool {
    let invoice_idx = text.find(INVOICE_NO_LABEL);
    if invoice_idx.is_none() {
        return false;
    }
    let invoice_idx = invoice_idx.unwrap();
    let prefix = &text[..invoice_idx];
    if MARKETING_MARKERS.iter().any(|m| prefix.contains(m)) {
        return true;
    }
    if invoice_idx >= V2_INVOICE_NO_MIN_OFFSET {
        return true;
    }
    if invoice_idx <= V1_INVOICE_NO_MAX_OFFSET {
        return false;
    }
    false
}

fn is_label_line(line: &str) -> bool {
    let stripped = line.trim();
    !stripped.is_empty() && stripped.ends_with(':')
}

fn stacked_label_amount(text: &str, label: &str) -> Option<String> {
    let lines = text.lines().collect::<Vec<_>>();
    let mut start: Option<usize> = None;
    let mut labels: Vec<String> = Vec::new();
    for (index, line) in lines.iter().enumerate() {
        if start.is_none() {
            if line.contains(INVOICE_NO_LABEL) {
                start = Some(index);
                labels.push(line.trim().to_string());
            }
            continue;
        }
        if is_label_line(line) {
            labels.push(line.trim().to_string());
            continue;
        }
        break;
    }
    let start = start?;
    if labels.is_empty() {
        return None;
    }
    let label_end = start + labels.len();
    let value_start = lines[label_end..]
        .iter()
        .position(|line| {
            let stripped = line.trim();
            if stripped.is_empty() {
                return false;
            }
            INVOICE_NUMBER.is_match(stripped)
                || CARD_LINE.is_match(stripped)
                || parse_date_string(stripped).is_some()
                || AMOUNT_ONLY.is_match(stripped)
        })
        .map(|i| label_end + i)?;
    let label_index = labels.iter().position(|l| label_regex(label).is_match(l))?;
    let value_index = value_start + label_index;
    if value_index >= lines.len() {
        return None;
    }
    first_amount_in_text(lines[value_index])
}

pub fn clean_text(raw: &str) -> String {
    if detect_layout(raw) {
        prepare_statement_text(raw, &[INVOICE_NO_LABEL])
    } else {
        prepare_statement_text(raw, &[])
    }
}

pub fn get_statement_date(text: &str) -> Option<NaiveDate> {
    if detect_layout(text) {
        let body = trim_statement_body(text, &[INVOICE_NO_LABEL]);
        return first_not_none([
            label_single_date_end(&body, "Invoice Date :"),
            date_after_label(&body, "Invoice Date :"),
        ]);
    }
    first_not_none([
        label_single_date_end(text, "Invoice Date :"),
        date_after_label(text, "Invoice Date :"),
        context_range_end(text, "From", " to "),
    ])
}

pub fn get_statement_period(text: &str) -> (Option<NaiveDate>, Option<NaiveDate>) {
    if detect_layout(text) {
        let body = trim_statement_body(text, &[INVOICE_NO_LABEL]);
        let (start, end) = context_range_period(&body, "From", " to ");
        if start.is_some() && end.is_some() {
            return (start, end);
        }
        for line in body.lines() {
            if let Some(caps) = STANDALONE_PERIOD_LINE.captures(line) {
                let start = parse_date_string(caps.get(1).map(|c| c.as_str()).unwrap_or(""));
                let end = parse_date_string(caps.get(2).map(|c| c.as_str()).unwrap_or(""));
                if start.is_some() && end.is_some() {
                    return (start, end);
                }
            }
        }
        let end = get_statement_date(text);
        return (None, end);
    }
    let (start, end) = context_range_period(text, "From", " to ");
    if start.is_some() && end.is_some() {
        return (start, end);
    }
    (None, get_statement_date(text))
}

pub fn get_opening_balance(text: &str) -> Option<String> {
    let body = if detect_layout(text) {
        trim_statement_body(text, &[INVOICE_NO_LABEL])
    } else {
        text.to_string()
    };
    summary_table_column(&body, "Account Summary", "Previous Balance", 2000)
}

pub fn get_closing_balance(text: &str) -> Option<String> {
    let body = if detect_layout(text) {
        trim_statement_body(text, &[INVOICE_NO_LABEL])
    } else {
        text.to_string()
    };
    first_not_none([
        summary_table_column(&body, "Account Summary", "Total Amount Due for Month", 2000),
        stacked_label_amount(&body, "Total Amount Due for Month"),
        stacked_label_amount(&body, "Total Amount Due"),
        label_single_amount(&body, "Total Amount Due for Month"),
        label_single_amount(&body, "Total Amount Due :"),
    ])
}
