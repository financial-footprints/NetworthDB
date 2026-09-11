use chrono::NaiveDate;

use super::imap_search::{build_gmail_raw_query, build_imap_search_criteria};

#[test]
fn gmail_raw_query_includes_subjects_and_dates_when_requested() {
    let start = NaiveDate::from_ymd_opt(2024, 1, 15).unwrap();
    let end = NaiveDate::from_ymd_opt(2024, 2, 1).unwrap();
    let query = build_gmail_raw_query(&["Statement".to_string()], Some(start), Some(end));
    assert!(query.contains("has:attachment"));
    assert!(query.contains("subject:\"Statement\""));
    assert!(query.contains("after:2024/01/15"));
    assert!(query.contains("before:2024/02/01"));
}

#[test]
fn gmail_imap_search_omits_received_date_filters() {
    let start = NaiveDate::from_ymd_opt(2022, 8, 21).unwrap();
    let end = NaiveDate::from_ymd_opt(2023, 10, 21).unwrap();
    let subjects = vec![
        "Your HDFC Bank - Regalia MasterCard Credit Card Statement".to_string(),
    ];
    let (_, criteria) =
        build_imap_search_criteria(&subjects, Some(start), "imap.gmail.com", Some(end));
    let raw = criteria.last().expect("gmail raw query");
    assert!(raw.contains("has:attachment"));
    assert!(raw.contains("subject:\"Your HDFC Bank - Regalia MasterCard Credit Card Statement\""));
    assert!(!raw.contains("after:"));
    assert!(!raw.contains("before:"));
}

#[test]
fn non_gmail_imap_search_keeps_date_filters() {
    let start = NaiveDate::from_ymd_opt(2022, 8, 21).unwrap();
    let end = NaiveDate::from_ymd_opt(2023, 10, 21).unwrap();
    let subjects = vec!["Statement".to_string()];
    let (_, criteria) =
        build_imap_search_criteria(&subjects, Some(start), "imap.example.com", Some(end));
    assert!(criteria.contains(&"SINCE".to_string()));
    assert!(criteria.contains(&"21-Aug-2022".to_string()));
    assert!(criteria.contains(&"BEFORE".to_string()));
    assert!(criteria.contains(&"21-Oct-2023".to_string()));
}
