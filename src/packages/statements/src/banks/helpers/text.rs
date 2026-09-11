use regex::Regex;
use std::sync::LazyLock;

static DISALLOWED: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"[^A-Za-z0-9 \n\r.,/\-:()%&@#*+=<>|_$]").expect("disallowed"));

fn normalize_line(line: &str) -> String {
    line.replace('\t', " ").trim_end().to_string()
}

pub fn sanitize_statement_text(raw: &str) -> String {
    let cleaned = DISALLOWED.replace_all(raw, " ");
    cleaned
        .split('\n')
        .map(normalize_line)
        .collect::<Vec<_>>()
        .join("\n")
}

pub fn trim_by_markers(raw: &str, trim_start: &[&str], trim_end: &[&str]) -> String {
    let lines: Vec<&str> = raw.split('\n').collect();
    let mut start_idx = 0usize;

    if !trim_start.is_empty() {
        let found: Vec<usize> = lines
            .iter()
            .enumerate()
            .filter(|(_, line)| trim_start.iter().any(|m| line.contains(m)))
            .map(|(i, _)| i)
            .collect();
        if !found.is_empty() {
            start_idx = *found.iter().min().unwrap();
        }
    }

    let mut end_idx = lines.len();
    if !trim_end.is_empty() {
        let found: Vec<usize> = lines
            .iter()
            .enumerate()
            .skip(start_idx)
            .filter(|(_, line)| trim_end.iter().any(|m| line.contains(m)))
            .map(|(i, _)| i)
            .collect();
        if found.is_empty() {
            if lines
                .iter()
                .any(|line| trim_end.iter().any(|m| line.contains(m)))
            {
                return String::new();
            }
        } else {
            end_idx = *found.iter().max().unwrap() + 1;
        }
    }

    if start_idx >= end_idx {
        return String::new();
    }

    lines[start_idx..end_idx].join("\n")
}

pub fn normalize_match_text(text: &str) -> String {
    let re = Regex::new(r"\s+").expect("whitespace");
    re.replace_all(text.trim(), " ").to_string()
}

pub fn text_contains_present(text: &str, text_contains: &[String]) -> bool {
    text_contains
        .iter()
        .any(|marker| !marker.is_empty() && text.contains(marker))
}

pub fn text_not_contains_violated(text: &str, text_not_contains: &[String]) -> bool {
    let normalized = normalize_match_text(text);
    text_not_contains
        .iter()
        .any(|marker| !marker.is_empty() && normalized.contains(&normalize_match_text(marker)))
}

pub fn statement_text_eligible(
    text: &str,
    text_contains: &[String],
    text_not_contains: &[String],
    is_manual: bool,
) -> bool {
    if !is_manual && text_not_contains_violated(text, text_not_contains) {
        return false;
    }
    !(text_contains.iter().any(|m| !m.is_empty()) && !text_contains_present(text, text_contains))
}

pub fn purge_drop_sections(text: &str, drop_sections: &[&str]) -> String {
    if drop_sections.is_empty() {
        return text.to_string();
    }
    let mut result = text.to_string();
    for marker in drop_sections {
        if marker.is_empty() {
            continue;
        }
        let pattern = Regex::new(&regex::escape(marker)).expect("drop marker");
        result = pattern.replace_all(&result, "").into_owned();
    }
    result
        .lines()
        .filter(|l| !l.trim().is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}
