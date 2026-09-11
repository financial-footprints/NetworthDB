//! IMAP / Gmail search criteria builders (NetworthCSV `get_statements/imap.py` port).

use chrono::{Datelike, NaiveDate};

pub fn escape_gmail_term(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

pub fn gmail_after_clause(start_date: Option<NaiveDate>) -> String {
    start_date
        .map(|d| format!(" after:{:04}/{:02}/{:02}", d.year(), d.month(), d.day()))
        .unwrap_or_default()
}

pub fn gmail_before_clause(end_date: Option<NaiveDate>) -> String {
    end_date
        .map(|d| format!(" before:{:04}/{:02}/{:02}", d.year(), d.month(), d.day()))
        .unwrap_or_default()
}

pub fn build_gmail_raw_query(
    subjects: &[String],
    start_date: Option<NaiveDate>,
    end_date: Option<NaiveDate>,
) -> String {
    let subject_terms = subjects
        .iter()
        .map(|s| format!("subject:\"{}\"", escape_gmail_term(s)))
        .collect::<Vec<_>>()
        .join(" OR ");
    format!(
        "has:attachment ({}){}{}",
        subject_terms,
        gmail_after_clause(start_date),
        gmail_before_clause(end_date)
    )
}

fn imap_since_clause(start_date: Option<NaiveDate>) -> String {
    start_date
        .map(|d| d.format("%d-%b-%Y").to_string())
        .unwrap_or_default()
}

fn imap_before_clause(end_date: Option<NaiveDate>) -> String {
    end_date
        .map(|d| d.format("%d-%b-%Y").to_string())
        .unwrap_or_default()
}

pub fn build_imap_search_criteria(
    subjects: &[String],
    start_date: Option<NaiveDate>,
    host: &str,
    end_date: Option<NaiveDate>,
) -> (Option<&'static str>, Vec<String>) {
    if host.trim_end_matches('.').ends_with("gmail.com") {
        return (
            None,
            vec![
                "X-GM-RAW".to_string(),
                build_gmail_raw_query(subjects, None, None),
            ],
        );
    }

    let mut criteria: Vec<String> = vec![];
    if start_date.is_some() {
        criteria.push("SINCE".to_string());
        criteria.push(imap_since_clause(start_date));
    }
    if end_date.is_some() {
        criteria.push("BEFORE".to_string());
        criteria.push(imap_before_clause(end_date));
    }

    if subjects.len() == 1 {
        criteria.push("SUBJECT".to_string());
        criteria.push(subjects[0].clone());
    } else if !subjects.is_empty() {
        let mut or_parts: Vec<String> = vec![];
        for subject in subjects.iter().rev() {
            if or_parts.is_empty() {
                or_parts = vec!["SUBJECT".to_string(), subject.clone()];
            } else {
                or_parts = vec!["OR".to_string(), "SUBJECT".to_string(), subject.clone()]
                    .into_iter()
                    .chain(or_parts)
                    .collect();
            }
        }
        criteria.extend(or_parts);
    }

    (Some("UTF-8"), criteria)
}
