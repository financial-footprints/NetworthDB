use regex::Regex;
use rust_decimal::Decimal;
use std::sync::LazyLock;

use crate::banks::helpers::{
    amounts_with_positions, equation_first_after, find_label, first_amount_in_text, first_not_none,
    label_regex,
};

static ORPHAN_CR_DR: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^(?:CR|DR)$").expect("orphan cr dr"));
static DATE_OR_RANGE_LINE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r"^\d{1,2}/(?:\d{1,2}|[A-Za-z]{3})/\d{2,4}(?:\s+-\s+\d{1,2}/(?:\d{1,2}|[A-Za-z]{3})/\d{2,4})?$",
    )
    .expect("date or range")
});
static DATE_ONLY_LINE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^\d{1,2}/(?:\d{1,2}|[A-Za-z]{3})/\d{2,4}$").expect("date only"));
static AMOUNT_TOKEN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)(?:\(?\s*(?:Rs\.?|INR|₹|[rC])\s*)?(-?,?\d[\d,]*(?:\.\d+)?|\.\d+)\s*(?:Cr|Dr|CR|DR)?\s*\)?")
        .expect("amount token")
});
static BONUS_BOUNDARY: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i)Bonus/Reward|Transaction Date").expect("boundary"));
static CLOSING_SCAN_STOP: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)Credit Limit|Page \d+ of|Late payment fee would be levied")
        .expect("closing scan stop")
});

fn signed_credit_card_amount(parsed: &str) -> String {
    let dec: Decimal = parsed.parse().unwrap_or(Decimal::ZERO);
    if dec > Decimal::ZERO {
        format!("-{:.2}", dec)
    } else {
        parsed.to_string()
    }
}

fn non_zero_amount(line: &str) -> Option<String> {
    wow_line_amount(line)
}

fn wow_line_amount(line: &str) -> Option<String> {
    let stripped = line.trim();
    if stripped.is_empty() || is_summary_date_line(stripped) {
        return None;
    }
    amounts_with_positions(line, true)
        .into_iter()
        .map(|(amount, _)| amount)
        .find(|amount| amount != "0.00")
}

fn summary_section_end(text: &str) -> usize {
    text.find("YOUR TRANSACTIONS")
        .or_else(|| text.find("IMPORTANT INFORMATION"))
        .unwrap_or(text.len())
}

fn opening_amount_from_row(amounts: &[(String, usize)]) -> Option<String> {
    for idx in [1_usize, 2, 0, 3] {
        if idx >= amounts.len() {
            continue;
        }
        let opening = &amounts[idx].0;
        if opening == "0.00" {
            continue;
        }
        return Some(signed_credit_card_amount(opening));
    }
    None
}

fn is_summary_date_line(line: &str) -> bool {
    let stripped = line.trim();
    DATE_ONLY_LINE.is_match(stripped) || DATE_OR_RANGE_LINE.is_match(stripped)
}

pub fn join_orphan_cr_dr(text: &str) -> String {
    let lines = text.lines().collect::<Vec<_>>();
    let mut result: Vec<String> = Vec::new();
    for line in lines {
        let stripped = line.trim();
        if ORPHAN_CR_DR.is_match(stripped) && !result.is_empty() {
            while result.last().map(|l| l.trim().is_empty()).unwrap_or(false) {
                result.pop();
            }
            if let Some(last) = result.pop() {
                result.push(format!("{} {}", last.trim_end(), stripped));
            }
            continue;
        }
        result.push(line.to_string());
    }
    result.join("\n")
}

pub fn normalize_cr_dr_layout(text: &str) -> String {
    join_orphan_cr_dr(text)
}

fn summary_row_amounts(line: &str) -> (Vec<(String, usize)>, bool) {
    let all = amounts_with_positions(line, false);
    if all.len() >= 3 {
        return (all, false);
    }
    let currency = amounts_with_positions(line, true);
    if currency.len() >= 3 {
        return (currency, true);
    }
    if all.len() >= 2 {
        return (all, false);
    }
    if currency.len() >= 2 {
        return (currency, true);
    }
    (vec![], true)
}

fn summary_table_header_seen(header_lines: &[String]) -> bool {
    static HEADER: LazyLock<Regex> =
        LazyLock::new(|| Regex::new(r"(?i)Opening|Balance|Total|Previous").expect("header"));
    header_lines.iter().any(|l| HEADER.is_match(l))
}

pub fn classic_summary_amounts(text: &str) -> Option<Vec<(String, usize)>> {
    let ctx_match = label_regex("STATEMENT SUMMARY").find(text)?;
    let mut header_lines: Vec<String> = Vec::new();
    for line in text[ctx_match.start()..text.len().min(ctx_match.start() + 2000)].lines() {
        let stripped = line.trim();
        if stripped.is_empty() {
            continue;
        }
        if BONUS_BOUNDARY.is_match(line) {
            break;
        }
        if is_summary_date_line(stripped) {
            continue;
        }
        let (row_amounts, currency_only) = summary_row_amounts(line);
        let r_prefixed = AMOUNT_TOKEN
            .find_iter(line)
            .filter(|m| m.as_str().trim().to_lowercase().starts_with('r'))
            .count();
        if r_prefixed >= 4 && summary_table_header_seen(&header_lines) {
            let amounts = amounts_with_positions(line, currency_only);
            if amounts.len() >= 4 {
                return Some(amounts);
            }
        }
        if row_amounts.len() < 3 {
            header_lines.push(line.to_string());
        }
    }
    None
}

pub fn classic_opening(text: &str) -> Option<String> {
    let amounts = classic_summary_amounts(text)?;
    opening_amount_from_row(&amounts)
}

pub fn classic_closing(text: &str) -> Option<String> {
    classic_summary_amounts(text).and_then(|amounts| {
        amounts
            .last()
            .map(|(value, _)| signed_credit_card_amount(value))
    })
}

fn opening_equation_amount(text: &str) -> Option<String> {
    let m = find_label(text, "Opening Balance")?;
    let end = summary_section_end(text);
    let mut candidate = None;
    for line in text[m.end()..end].lines() {
        if is_summary_date_line(line.trim()) {
            continue;
        }
        let amounts = amounts_with_positions(line, false);
        if amounts.len() >= 3 && !amounts_with_positions(line, true).is_empty() {
            if let Some(opening) = opening_amount_from_row(&amounts) {
                candidate = Some(opening);
            }
        }
    }
    candidate
}

fn label_preceding_amount(text: &str, label: &str, max_lines: usize) -> Option<String> {
    let m = find_label(text, label)?;
    let lines: Vec<_> = text[..m.start()].lines().collect();
    for line in lines.iter().rev().take(max_lines) {
        if let Some(amount) = non_zero_amount(line) {
            return Some(amount);
        }
    }
    None
}

fn label_following_amount(text: &str, label: &str, max_lines: usize) -> Option<String> {
    let m = find_label(text, label)?;
    for line in text[m.end()..].lines().take(max_lines) {
        if find_label(line, "YOUR TRANSACTIONS").is_some() {
            break;
        }
        if let Some(amount) = non_zero_amount(line) {
            return Some(amount);
        }
    }
    None
}

fn label_nearby_amount(text: &str, label: &str) -> Option<String> {
    first_not_none([
        label_preceding_amount(text, label, 6),
        label_following_amount(text, label, 10),
    ])
}

fn label_last_non_zero_amount(text: &str, label: &str) -> Option<String> {
    let end = summary_section_end(text);
    let section = &text[..end];
    let mut last_match = None;
    for m in label_regex(label).find_iter(section) {
        last_match = Some(m);
    }
    let m = last_match?;
    let mut last = None;
    for line in text[m.end()..end].lines() {
        if CLOSING_SCAN_STOP.is_match(line) {
            break;
        }
        if let Some(amount) = non_zero_amount(line) {
            last = Some(amount);
        }
    }
    last
}

fn stacked_summary_closing(text: &str) -> Option<String> {
    let section = &text[..summary_section_end(text)];
    let mut last = None;
    for line in section.lines() {
        if let Some(amount) = non_zero_amount(line) {
            last = Some(amount);
        }
    }
    last
}

pub fn inline_equation_amount(text: &str, label: &str) -> Option<String> {
    let m = find_label(text, label)?;
    let line_start = text[..m.start()].rfind('\n').map(|i| i + 1).unwrap_or(0);
    let line_end = text[m.end()..]
        .find('\n')
        .map(|i| m.end() + i)
        .unwrap_or(text.len());
    first_amount_in_text(&text[line_start..line_end])
}

pub fn wow_opening_balance(text: &str) -> Option<String> {
    let normalized = normalize_cr_dr_layout(text);
    first_not_none([
        classic_opening(&normalized),
        inline_equation_amount(&normalized, "Opening Balance"),
        opening_equation_amount(&normalized),
        label_nearby_amount(&normalized, "Opening Balance"),
    ])
}

pub fn wow_closing_balance(text: &str) -> Option<String> {
    let normalized = normalize_cr_dr_layout(text);
    first_not_none([
        classic_closing(&normalized),
        label_last_non_zero_amount(&normalized, "Total Amount Due"),
        equation_first_after(&normalized, "Total Amount Due"),
        inline_equation_amount(&normalized, "Total Amount Due"),
        stacked_summary_closing(&normalized),
    ])
}
