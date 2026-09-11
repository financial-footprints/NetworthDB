//! Shared email message filtering (minimal port for extract stage).

use chrono::{Datelike, NaiveDate};
use regex::Regex;
use std::sync::LazyLock;

static UNSAFE_CHARS: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"[<>:/\\|?*]+").expect("unsafe chars"));

pub fn sanitize_filename(name: &str) -> String {
    let name = std::path::Path::new(name)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "attachment".to_string());
    let cleaned = UNSAFE_CHARS.replace_all(name.trim(), "_");
    if cleaned.is_empty() {
        "attachment".to_string()
    } else {
        cleaned.to_string()
    }
}

pub fn subject_matches(subject: &str, subjects: &[String]) -> bool {
    let lowered = subject.to_lowercase();
    subjects
        .iter()
        .any(|entry| !entry.is_empty() && lowered.contains(&entry.to_lowercase()))
}

pub fn body_matches(body: &str, attachment_names: &[String], body_contains: &[String]) -> bool {
    if body_contains.is_empty() {
        return true;
    }
    let haystack = format!("{}\n{}", body, attachment_names.join("\n")).to_lowercase();
    body_contains
        .iter()
        .any(|entry| !entry.is_empty() && haystack.contains(&entry.to_lowercase()))
}

pub fn from_matches(from: &str, from_filters: &[String]) -> bool {
    if from_filters.is_empty() {
        return true;
    }
    let lowered = from.to_lowercase();
    for entry in from_filters {
        if entry.contains('@') {
            if lowered.contains(&entry.to_lowercase()) {
                return true;
            }
        } else {
            let mut needle = String::new();
            needle.push('@');
            needle.push_str(&entry.to_lowercase());
            if lowered.contains(&needle) {
                return true;
            }
        }
    }
    false
}

pub fn message_in_date_range(
    received: Option<NaiveDate>,
    start_date: Option<NaiveDate>,
    end_date: Option<NaiveDate>,
) -> bool {
    let msg_month = match received {
        Some(dt) => NaiveDate::from_ymd_opt(dt.year(), dt.month(), 1),
        None => return false,
    };
    let msg_month = msg_month.unwrap();
    if let Some(start) = start_date {
        let range_start = NaiveDate::from_ymd_opt(start.year(), start.month(), 1).unwrap();
        if msg_month < range_start {
            return false;
        }
    }
    if let Some(end) = end_date {
        let range_end = NaiveDate::from_ymd_opt(end.year(), end.month(), 1).unwrap();
        if msg_month > range_end {
            return false;
        }
    }
    true
}
