use chrono::NaiveDate;
use regex::{Captures, Regex};
use std::collections::HashMap;
use std::sync::LazyLock;

static DATE_FORMATS: &[&str] = &[
    "%d/%m/%Y",
    "%d-%m-%Y",
    "%d/%b/%Y",
    "%d/%b/%y",
    "%d %b, %Y",
    "%d %b %Y",
    "%d %b %y",
    "%d %B, %Y",
    "%d %B %Y",
    "%B %d, %Y",
    "%d-%b-%Y",
    "%d-%b-%y",
];

static DATE_CANDIDATE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r"(?i)(?:\d{1,2}/\d{1,2}/\d{4}|\d{1,2}-\d{1,2}-\d{4}|\d{1,2}/[A-Za-z]{3}/\d{4}|\d{1,2}-[A-Za-z]{3}-\d{4}|\d{1,2}\s+[A-Za-z]{3,9},?\s+\d{4}|[A-Za-z]+\s+\d{1,2},?\s+\d{4})",
    )
    .expect("date candidate regex")
});

static SPACED_DAY: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i)(\d)\s+(\d-[A-Za-z]{3}-\d{4})").expect("spaced day regex"));

static LABEL_CACHE: LazyLock<std::sync::Mutex<HashMap<String, Regex>>> =
    LazyLock::new(|| std::sync::Mutex::new(HashMap::new()));

fn normalize_spaced_date_text(text: &str) -> String {
    SPACED_DAY
        .replace_all(text, |caps: &Captures| format!("{}{}", &caps[1], &caps[2]))
        .into_owned()
}

pub fn parse_date_string(value: &str) -> Option<NaiveDate> {
    let stripped = value.trim().trim_end_matches(',');
    if stripped.is_empty() {
        return None;
    }
    for fmt in DATE_FORMATS {
        if let Ok(parsed) = chrono::NaiveDate::parse_from_str(stripped, fmt) {
            return Some(parsed);
        }
    }
    None
}

fn word_pattern(word: &str) -> String {
    let word = word.trim();
    if word.is_empty() {
        return String::new();
    }
    if word.chars().all(|c| c.is_ascii_alphabetic()) {
        word.chars()
            .map(|ch| format!("{}+\\s*", regex::escape(&ch.to_string())))
            .collect::<String>()
            .trim_end_matches("\\s*")
            .to_string()
    } else {
        regex::escape(word)
    }
}

pub fn label_regex(label: &str) -> Regex {
    let mut cache = LABEL_CACHE.lock().expect("label cache");
    if let Some(re) = cache.get(label) {
        return re.clone();
    }
    let words: Vec<&str> = label.split_whitespace().collect();
    let body = words
        .iter()
        .map(|w| word_pattern(w))
        .filter(|w| !w.is_empty())
        .collect::<Vec<_>>()
        .join(r"\s+");
    let re = Regex::new(&body).expect("label regex");
    cache.insert(label.to_string(), re.clone());
    re
}

pub fn find_label<'a>(text: &'a str, label: &str) -> Option<regex::Match<'a>> {
    let limit = text.len().min(4000);
    label_regex(label).find(&text[..limit])
}

fn first_date_in_text(text: &str) -> Option<NaiveDate> {
    let normalized = normalize_spaced_date_text(text);
    for m in DATE_CANDIDATE.find_iter(&normalized) {
        if let Some(parsed) = parse_date_string(m.as_str()) {
            return Some(parsed);
        }
    }
    None
}

fn last_date_in_text(text: &str) -> Option<NaiveDate> {
    let normalized = normalize_spaced_date_text(text);
    let mut last = None;
    for m in DATE_CANDIDATE.find_iter(&normalized) {
        if let Some(parsed) = parse_date_string(m.as_str()) {
            last = Some(parsed);
        }
    }
    last
}

fn bounds_from_joiner(left: &str, right: &str) -> (Option<NaiveDate>, Option<NaiveDate>) {
    (last_date_in_text(left), first_date_in_text(right))
}

fn line_remainder_after_match(text: &str, start: usize, end: usize) -> String {
    let line_start = text[..start].rfind('\n').map(|i| i + 1).unwrap_or(0);
    let line_end = text[end..]
        .find('\n')
        .map(|i| end + i)
        .unwrap_or(text.len());
    let line = &text[line_start..line_end];
    let offset = end - line_start;
    line[offset..].to_string()
}

pub fn line_remainder_after_label(text: &str, label: &str) -> Option<String> {
    let m = find_label(text, label)?;
    Some(line_remainder_after_match(text, m.start(), m.end()))
}

pub fn date_after_label(text: &str, label: &str) -> Option<NaiveDate> {
    let m = find_label(text, label)?;
    let remainder = line_remainder_after_match(text, m.start(), m.end());
    if !remainder.trim().is_empty() {
        for joiner in [" to ", " - ", " To "] {
            if let Some(pos) = remainder.find(joiner) {
                let left = &remainder[..pos];
                let right = &remainder[pos + joiner.len()..];
                let (_, end) = bounds_from_joiner(left, right);
                if end.is_some() {
                    return end;
                }
            }
        }
        if let Some(d) = first_date_in_text(&remainder) {
            return Some(d);
        }
    }
    let start = m.end();
    let slice_end = text.len().min(start + 4000);
    let tail = &text[start..slice_end];
    let search_text = match tail.find('\n') {
        None => tail,
        Some(i) => &tail[i + 1..],
    };
    for line in search_text.lines() {
        let stripped = line.trim();
        if stripped.is_empty() {
            continue;
        }
        if let Some(parsed) = first_date_in_text(stripped) {
            return Some(parsed);
        }
    }
    None
}

fn parse_range_bounds(remainder: &str) -> (Option<NaiveDate>, Option<NaiveDate>) {
    for joiner in [" to ", " - ", " To "] {
        if let Some(pos) = remainder.find(joiner) {
            let left = &remainder[..pos];
            let right = &remainder[pos + joiner.len()..];
            let (start, end) = bounds_from_joiner(left, right);
            if start.is_some() && end.is_some() {
                return (start, end);
            }
        }
    }
    (None, first_date_in_text(remainder))
}

pub fn label_single_date_end(text: &str, label: &str) -> Option<NaiveDate> {
    let remainder = line_remainder_after_label(text, label)?;
    let (_, end) = parse_range_bounds(&remainder);
    end
}

pub fn label_range_period(
    text: &str,
    label: &str,
    joiner: &str,
) -> (Option<NaiveDate>, Option<NaiveDate>) {
    let m = match find_label(text, label) {
        Some(m) => m,
        None => return (None, None),
    };
    let remainder = &text[m.end()..text.len().min(m.end() + 300)];
    if !remainder.contains(joiner) {
        return (None, None);
    }
    let pos = remainder.find(joiner).unwrap_or(0);
    let left = &remainder[..pos];
    let right = &remainder[pos + joiner.len()..];
    bounds_from_joiner(left, right)
}

pub fn label_range_end(text: &str, label: &str, joiner: &str) -> Option<NaiveDate> {
    label_range_period(text, label, joiner).1
}

pub fn context_range_period(
    text: &str,
    context: &str,
    joiner: &str,
) -> (Option<NaiveDate>, Option<NaiveDate>) {
    let context_re = Regex::new(&regex::escape(context)).expect("context regex");
    let haystack = &text[..text.len().min(4000)];
    for context_match in context_re.find_iter(haystack) {
        let start = context_match.start().saturating_sub(250);
        let end_pos = (context_match.end() + 500).min(haystack.len());
        let window = &haystack[start..end_pos];
        let joiner_re = Regex::new(&regex::escape(joiner)).expect("joiner regex");
        for joiner_match in joiner_re.find_iter(window) {
            let left = &window[joiner_match.start().saturating_sub(80)..joiner_match.start()];
            let right = &window[joiner_match.end()..(joiner_match.end() + 80).min(window.len())];
            let (period_start, period_end) = bounds_from_joiner(left, right);
            if period_start.is_some() && period_end.is_some() {
                return (period_start, period_end);
            }
        }
    }
    (None, None)
}

pub fn context_range_end(text: &str, context: &str, joiner: &str) -> Option<NaiveDate> {
    let (_, end) = context_range_period(text, context, joiner);
    if end.is_some() {
        return end;
    }
    let context_re = Regex::new(&regex::escape(context)).expect("context regex");
    let haystack = &text[..text.len().min(4000)];
    for context_match in context_re.find_iter(haystack) {
        let start = context_match.start().saturating_sub(250);
        let end_pos = (context_match.end() + 500).min(haystack.len());
        let window = &haystack[start..end_pos];
        let joiner_re = Regex::new(&regex::escape(joiner)).expect("joiner regex");
        for joiner_match in joiner_re.find_iter(window) {
            let left = &window[joiner_match.start().saturating_sub(80)..joiner_match.start()];
            let right = &window[joiner_match.end()..(joiner_match.end() + 80).min(window.len())];
            let left_date = last_date_in_text(left);
            let right_date = first_date_in_text(right);
            if left_date.is_some() && right_date.is_some() {
                return right_date;
            }
        }
    }
    None
}

pub fn top_range_period_with_chars(
    text: &str,
    joiner: &str,
    search_chars: usize,
) -> (Option<NaiveDate>, Option<NaiveDate>) {
    let haystack = &text[..text.len().min(search_chars)];
    let joiner_re = Regex::new(&regex::escape(joiner)).expect("joiner regex");
    for m in joiner_re.find_iter(haystack) {
        let left_start = m.start().saturating_sub(80);
        let left = &haystack[left_start..m.start()];
        let right_end = (m.end() + 80).min(haystack.len());
        let right = &haystack[m.end()..right_end];
        let (start, end) = bounds_from_joiner(left, right);
        if start.is_some() && end.is_some() {
            return (start, end);
        }
    }
    (None, None)
}

pub fn top_range_period(text: &str, joiner: &str) -> (Option<NaiveDate>, Option<NaiveDate>) {
    top_range_period_with_chars(text, joiner, 2000)
}

pub fn top_range_end(text: &str, joiner: &str, search_chars: usize) -> Option<NaiveDate> {
    let (_, end) = top_range_period_with_chars(text, joiner, search_chars);
    if end.is_some() {
        return end;
    }
    let haystack = &text[..text.len().min(search_chars)];
    let joiner_re = Regex::new(&regex::escape(joiner)).expect("joiner regex");
    for m in joiner_re.find_iter(haystack) {
        let left_start = m.start().saturating_sub(80);
        let left = &haystack[left_start..m.start()];
        let right_end = (m.end() + 80).min(haystack.len());
        let right = &haystack[m.end()..right_end];
        let left_date = last_date_in_text(left);
        let right_date = first_date_in_text(right);
        if left_date.is_some() && right_date.is_some() {
            return right_date;
        }
    }
    None
}
