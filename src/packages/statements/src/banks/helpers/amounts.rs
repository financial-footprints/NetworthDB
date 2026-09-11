use regex::Regex;
use rust_decimal::Decimal;
use std::sync::LazyLock;

static AMOUNT_TOKEN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r"(?i)(?:\(?\s*(?:Rs\.?|INR|₹|[rC])\s*)?(-?,?\d[\d,]*(?:\.\d+)?|\.\d+)\s*(?:Cr|Dr|CR|DR)?\s*\)?",
    )
    .expect("amount token")
});

static CURRENCY_AMOUNT_TOKEN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r"(?i)(?:\(?\s*(?:Rs\.?|INR|₹|[rC])\s*)?(-?,?\d[\d,]*\.\d+|\.\d+)\s*(?:Cr|Dr|CR|DR)?\s*\)?",
    )
    .expect("currency amount token")
});

static CID_PATTERN: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i)\(cid:\d+\)").expect("cid pattern"));

pub fn parse_amount_string(value: &str) -> Option<String> {
    let mut working = value.trim().to_string();
    if working.is_empty() {
        return None;
    }

    let mut negative = false;
    if working.starts_with('(') && working.ends_with(')') {
        negative = true;
        working = working[1..working.len() - 1].trim().to_string();
    }

    let re_prefix = Regex::new(r"(?i)^(?:Rs\.?|INR|₹|[rC])\s*").expect("currency prefix");
    working = re_prefix.replace(&working, "").trim().to_string();
    if working.starts_with('-') {
        negative = true;
        working = working[1..].trim().to_string();
    }
    working = working.trim_start_matches(',').to_string();

    let credit = Regex::new(r"(?i)\bCr\b").expect("cr").is_match(&working);
    let debit = Regex::new(r"(?i)\bDr\b").expect("dr").is_match(&working);
    let re_suffix = Regex::new(r"(?i)\s*(?:Cr|Dr|CR|DR)\s*$").expect("dr cr suffix");
    working = re_suffix.replace(&working, "").trim().to_string();
    working = working.replace(',', "");
    if working.is_empty() {
        return None;
    }

    let amount: Decimal = match working.parse() {
        Ok(a) => a,
        Err(_) => return None,
    };
    let amount = if negative { -amount } else { amount };
    let amount = if credit {
        -amount.abs()
    } else if debit {
        amount.abs()
    } else {
        amount
    };
    Some(format!("{:.2}", amount))
}

fn is_inside_cid(text: &str, index: usize) -> bool {
    for m in CID_PATTERN.find_iter(text) {
        if m.start() <= index && index < m.end() {
            return true;
        }
    }
    false
}

pub fn first_amount_in_text(text: &str) -> Option<String> {
    for m in AMOUNT_TOKEN.find_iter(text) {
        if is_inside_cid(text, m.start()) {
            continue;
        }
        if let Some(parsed) = parse_amount_string(m.as_str()) {
            return Some(parsed);
        }
    }
    None
}

pub fn first_not_none<T>(values: impl IntoIterator<Item = Option<T>>) -> Option<T> {
    values.into_iter().find(|v| v.is_some()).flatten()
}

fn default_balance_tolerance() -> Decimal {
    Decimal::new(21, 2)
}

pub fn balances_match(left: &str, right: &str, tolerance: Option<Decimal>) -> bool {
    let threshold = tolerance.unwrap_or_else(default_balance_tolerance);
    let left_parsed = parse_amount_string(left);
    let right_parsed = parse_amount_string(right);
    match (left_parsed, right_parsed) {
        (Some(left), Some(right)) => {
            let left_dec: Decimal = left.parse().unwrap_or(Decimal::ZERO);
            let right_dec: Decimal = right.parse().unwrap_or(Decimal::ZERO);
            (left_dec - right_dec).abs() <= threshold
        }
        _ => left == right,
    }
}

pub fn amounts_with_positions(line: &str, currency_only: bool) -> Vec<(String, usize)> {
    let pattern = if currency_only {
        &*CURRENCY_AMOUNT_TOKEN
    } else {
        &*AMOUNT_TOKEN
    };
    let mut found = Vec::new();
    for m in pattern.find_iter(line) {
        if is_inside_cid(line, m.start()) {
            continue;
        }
        if let Some(parsed) = parse_amount_string(m.as_str()) {
            found.push((parsed, m.start()));
        }
    }
    found
}
