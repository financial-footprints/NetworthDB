use regex::Regex;
use std::sync::LazyLock;

use super::amounts::{amounts_with_positions, first_amount_in_text, parse_amount_string};
use super::dates::{find_label, label_regex};

static TABLE_SECTION_BOUNDARY: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"Bonus/Reward|Transaction Date|Transaction Details|Reward Summary")
        .expect("table section boundary")
});

static SUMMARY_TABLE_HEADER: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r"Opening|Balance|Total\s+Dues|Credits|Debits|Charges|Payment|Purchase|Finance|Previous\s+Balance|Closing\s+Balance",
    )
    .expect("summary table header")
});

static RS_AMOUNT: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"Rs\.?\s*(-?\d[\d,]*(?:\.\d+)?|\.\d+)").expect("rs amount"));

static DATE_IN_LINE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\d{1,2}/\d{1,2}/\d{4}|\d{1,2}\s+[A-Z]{3}\s+\d{4}").expect("date in line")
});

static DATE_ONLY_LINE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^\d{1,2}/(?:\d{1,2}|[A-Za-z]{3})/\d{2,4}$").expect("date only line")
});

static OUTSTANDING_SECTION_END: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^(?:Rewards\b|Invoice\b|Payment\s*Due\s*Date\b)").expect("outstanding section end")
});

static TOTAL_ROW: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^Total\b").expect("total row"));

fn is_table_section_boundary(line: &str) -> bool {
    TABLE_SECTION_BOUNDARY.is_match(line)
}

fn summary_table_header_seen(header_lines: &[String]) -> bool {
    header_lines
        .iter()
        .any(|line| SUMMARY_TABLE_HEADER.is_match(line))
}

fn label_position_in_headers(header_lines: &[String], column: &str) -> Option<usize> {
    for line in header_lines {
        if let Some(m) = label_regex(column).find(line) {
            return Some(m.start());
        }
    }
    let words: Vec<&str> = column.split_whitespace().collect();
    if words.is_empty() {
        return None;
    }
    if words.len() > 1 {
        let mut last_pos = None;
        let mut first_pos = None;
        for line in header_lines {
            if let Some(m) = label_regex(words[words.len() - 1]).find(line) {
                last_pos = Some(m.start());
            }
            if first_pos.is_none() {
                if let Some(m) = label_regex(words[0]).find(line) {
                    first_pos = Some(m.start());
                }
            }
        }
        return last_pos.or(first_pos);
    }
    for line in header_lines {
        if let Some(m) = label_regex(words[0]).find(line) {
            return Some(m.start());
        }
    }
    None
}

fn summary_row_amounts(line: &str) -> (Vec<(String, usize)>, bool) {
    let all_amounts = amounts_with_positions(line, false);
    if all_amounts.len() >= 3 {
        return (all_amounts, false);
    }
    let currency_amounts = amounts_with_positions(line, true);
    if currency_amounts.len() >= 3 {
        return (currency_amounts, true);
    }
    if all_amounts.len() >= 2 {
        return (all_amounts, false);
    }
    if currency_amounts.len() >= 2 {
        return (currency_amounts, true);
    }
    (vec![], true)
}

fn column_index_for_label(
    header_lines: &[String],
    data_line: &str,
    column: &str,
    currency_only: bool,
) -> Option<usize> {
    let label_pos = label_position_in_headers(header_lines, column)?;
    let amounts = amounts_with_positions(data_line, currency_only);
    if amounts.is_empty() {
        return None;
    }
    if amounts.len() == 1 {
        return Some(0);
    }
    amounts
        .iter()
        .enumerate()
        .min_by_key(|(_, (_, pos))| pos.abs_diff(label_pos))
        .map(|(i, _)| i)
}

pub fn summary_table_column(
    text: &str,
    context: &str,
    column: &str,
    search_chars: usize,
) -> Option<String> {
    let ctx_match = label_regex(context).find(text)?;
    let window = &text[ctx_match.start()..text.len().min(ctx_match.start() + search_chars)];
    let lines = window.lines().collect::<Vec<_>>();

    let mut header_lines: Vec<String> = Vec::new();
    let mut data_line: Option<String> = None;
    let mut data_currency_only = true;

    for line in lines {
        let stripped = line.trim();
        if stripped.is_empty() {
            continue;
        }
        if is_table_section_boundary(line) {
            break;
        }
        if DATE_ONLY_LINE.is_match(stripped) {
            continue;
        }
        let (row_amounts, row_currency_only) = summary_row_amounts(line);
        if row_amounts.len() >= 3 && summary_table_header_seen(&header_lines) {
            data_line = Some(line.to_string());
            data_currency_only = row_currency_only;
            break;
        }
        header_lines.push(line.to_string());
    }

    let data_line = data_line?;
    if header_lines.is_empty() {
        return None;
    }

    let col_index = column_index_for_label(&header_lines, &data_line, column, data_currency_only)?;
    let amounts = amounts_with_positions(&data_line, data_currency_only);
    amounts.get(col_index).map(|(a, _)| a.clone())
}

pub fn summary_table_row(text: &str, after: &str, which: usize, column: &str) -> Option<String> {
    let anchor = find_label(text, after)?;
    let tail = &text[anchor.end()..text.len().min(anchor.end() + 1200)];
    let mut match_count = 0usize;
    for line in tail.lines() {
        let amounts = amounts_with_positions(line, true);
        if amounts.len() < 3 {
            continue;
        }
        match_count += 1;
        if match_count < which {
            continue;
        }
        return if column == "opening" {
            Some(amounts[0].0.clone())
        } else {
            Some(amounts.last().map(|(a, _)| a.clone()).unwrap_or_default())
        };
    }
    None
}

pub fn edge_summary_opening(text: &str) -> Option<String> {
    for line in text[..text.len().min(4000)].lines() {
        let date_match = DATE_IN_LINE.find(line);
        let amount_match = RS_AMOUNT.find(line);
        if let (Some(dm), Some(am)) = (date_match, amount_match) {
            if am.start() >= dm.start() {
                return parse_amount_string(am.as_str());
            }
        }
    }
    None
}

pub fn edge_summary_closing(text: &str) -> Option<String> {
    RS_AMOUNT
        .find(&text[..text.len().min(3000)])
        .and_then(|m| parse_amount_string(m.as_str()))
}

pub fn label_single_amount(text: &str, label: &str) -> Option<String> {
    let m = find_label(text, label)?;
    let window_end = text.len().min(m.end() + 400);
    for line in text[m.end()..window_end].lines() {
        let stripped = line.trim();
        if stripped.is_empty() {
            continue;
        }
        if DATE_ONLY_LINE.is_match(stripped) {
            continue;
        }
        if let Some(parsed) = first_amount_in_text(line) {
            return Some(parsed);
        }
    }
    None
}

pub fn label_next_line_amount(text: &str, label: &str) -> Option<String> {
    let m = find_label(text, label)?;
    let tail = &text[m.end()..text.len().min(m.end() + 400)];
    let line_break = tail.find('\n').unwrap_or(tail.len());
    if line_break == tail.len() {
        return None;
    }
    for line in tail[line_break + 1..].lines() {
        let stripped = line.trim();
        if stripped.is_empty() {
            continue;
        }
        let currency_amounts = amounts_with_positions(line, true);
        if let Some((amount, _)) = currency_amounts.first() {
            return Some(amount.clone());
        }
        let amounts = amounts_with_positions(line, false);
        if let Some((amount, _)) = amounts.first() {
            return Some(amount.clone());
        }
    }
    None
}

pub fn total_outstanding_section_amount(text: &str) -> Option<String> {
    let m = label_regex("Total Outstanding").find(&text[..text.len().min(4000)])?;
    let tail = &text[m.start()..];
    let line_break = tail.find('\n').unwrap_or(tail.len());
    let window = &tail[line_break + 1..tail.len().min(line_break + 1 + 500)];
    let mut last_single: Option<String> = None;
    let mut total_line_last: Option<String> = None;
    for line in window.lines() {
        let stripped = line.trim();
        if stripped.is_empty() {
            continue;
        }
        if OUTSTANDING_SECTION_END.is_match(stripped) {
            break;
        }
        let amounts = amounts_with_positions(line, true);
        if amounts.is_empty() {
            continue;
        }
        if amounts.len() == 1 {
            last_single = Some(amounts[0].0.clone());
        } else if amounts.len() > 1 && TOTAL_ROW.is_match(stripped) {
            total_line_last = amounts.last().map(|(a, _)| a.clone());
        }
    }
    last_single.or(total_line_last)
}

pub fn single_amount_after(text: &str, anchor: &str) -> Option<String> {
    let m = find_label(text, anchor)?;
    let window = &text[m.end()..text.len().min(m.end() + 500)];
    for line in window.lines() {
        let stripped = line.trim();
        if stripped.is_empty() {
            continue;
        }
        let amounts = amounts_with_positions(line, false);
        if amounts.len() == 1 {
            return Some(amounts[0].0.clone());
        }
    }
    None
}

pub fn equation_first_after(text: &str, anchor: &str) -> Option<String> {
    let m = find_label(text, anchor)?;
    let window = &text[m.end()..text.len().min(m.end() + 600)];
    for line in window.lines() {
        if !line.contains('=') {
            continue;
        }
        let amounts = amounts_with_positions(line, false);
        if let Some((amount, _)) = amounts.first() {
            return Some(amount.clone());
        }
    }
    None
}
