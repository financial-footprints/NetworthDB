use regex::Regex;
use std::sync::LazyLock;

static OPENING_SUMMARY_LINE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r"^(\s*)((?:\d{1,2}/\d{1,2}/\d{4}|\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s+)?(Rs\.?\s*-?\d[\d,]*(?:\.\d+)?|\.\d+)\s*$",
    )
    .expect("opening summary line")
});

static AMOUNT_ONLY_LINE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^(\s*)(Rs\.?\s*-?\d[\d,]*(?:\.\d+)?|\.\d+)\s*$").expect("amount only line")
});

static DATE_BEFORE_AMOUNT: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\d{1,2}/\d{1,2}/\d{4}|\d{1,2}\s+[A-Za-z]{3}\s+\d{4}").expect("date before amount")
});

static RS_AMOUNT: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"Rs\.?\s*(-?\d[\d,]*(?:\.\d+)?|\.\d+)").expect("rs amount"));

pub const EDGE_SUMMARY_LABELS: &[&str] = &[
    "Opening Balance",
    "Spends",
    "Cash Advances",
    "Fees & Charges",
    "Interest Charges",
    "Repayments & Refunds",
    "Paid via points",
    "Total Amount Due",
];

pub fn inject_edge_summary_labels(text: &str) -> String {
    if text.trim().is_empty() {
        return text.to_string();
    }
    if text.contains("Opening Balance") && text.contains("Total Amount Due") {
        return text.to_string();
    }

    let mut lines: Vec<String> = text.lines().map(|l| l.to_string()).collect();
    let mut start_idx: Option<usize> = None;
    for (index, line) in lines.iter().enumerate() {
        if !OPENING_SUMMARY_LINE.is_match(line) {
            continue;
        }
        let date_match = DATE_BEFORE_AMOUNT.find(line);
        let amount_match = RS_AMOUNT.find(line);
        if let (Some(dm), Some(am)) = (date_match, amount_match) {
            if dm.start() < am.start() {
                start_idx = Some(index);
                break;
            }
        }
    }
    let start_idx = match start_idx {
        Some(i) => i,
        None => return text.to_string(),
    };

    let mut collected: Vec<(usize, String, (usize, usize))> = Vec::new();
    let mut index = start_idx;
    while index < lines.len() && collected.len() < EDGE_SUMMARY_LABELS.len() {
        let line = &lines[index];
        if line.trim().is_empty() {
            index += 1;
            continue;
        }
        let match_line = AMOUNT_ONLY_LINE
            .find(line)
            .or_else(|| OPENING_SUMMARY_LINE.find(line));
        let amount_match = RS_AMOUNT.find(line);
        if match_line.is_none() || amount_match.is_none() {
            break;
        }
        let amount_match = amount_match.unwrap();
        collected.push((
            index,
            line.clone(),
            (amount_match.start(), amount_match.end()),
        ));
        index += 1;
    }

    if collected.len() != EDGE_SUMMARY_LABELS.len() {
        return text.to_string();
    }

    for (label_index, (line_index, line, (amount_start, _amount_end))) in
        collected.iter().enumerate()
    {
        let label = EDGE_SUMMARY_LABELS[label_index];
        let prefix = line
            .chars()
            .take_while(|c| c.is_whitespace())
            .collect::<String>();
        let before_amount = line[..*amount_start].trim_end();
        let amount_and_rest = &line[*amount_start..];
        if !before_amount.trim().is_empty() {
            let left = before_amount[prefix.len()..].trim();
            lines[*line_index] = format!(
                "{}{}  {}  {}",
                prefix,
                label,
                left,
                amount_and_rest.trim_start()
            );
        } else {
            lines[*line_index] = format!("{}{}  {}", prefix, label, amount_and_rest.trim_start());
        }
    }

    lines.join("\n")
}
