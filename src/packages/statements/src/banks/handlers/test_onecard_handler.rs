use chrono::NaiveDate;
use std::fs;
use std::path::PathBuf;

use super::get_handler;

fn fixture_path(name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures/onecard/default")
        .join(name)
}

#[test]
fn onecard_sample_balances_and_period() {
    let text = fs::read_to_string(fixture_path("sample.txt")).expect("read fixture");
    let handler = get_handler("onecard", Some("default")).expect("handler");
    assert_eq!(
        handler.get_statement_date(&text),
        Some(NaiveDate::from_ymd_opt(2021, 9, 1).unwrap())
    );
    assert_eq!(
        handler.get_opening_balance(&text).as_deref(),
        Some("-5000.00")
    );
    assert_eq!(
        handler.get_closing_balance(&text).as_deref(),
        Some("-1250.00")
    );
    let (start, end) = handler.get_statement_period(&text);
    assert_eq!(start, Some(NaiveDate::from_ymd_opt(2021, 8, 1).unwrap()));
    assert_eq!(end, Some(NaiveDate::from_ymd_opt(2021, 8, 31).unwrap()));
}

#[test]
fn onecard_empty_balances_and_period() {
    let text = fs::read_to_string(fixture_path("empty.txt")).expect("read fixture");
    let handler = get_handler("onecard", Some("default")).expect("handler");
    assert_eq!(
        handler.get_statement_date(&text),
        Some(NaiveDate::from_ymd_opt(2024, 4, 1).unwrap())
    );
    assert_eq!(handler.get_opening_balance(&text).as_deref(), Some("0.00"));
    assert_eq!(handler.get_closing_balance(&text).as_deref(), Some("0.00"));
    let (start, end) = handler.get_statement_period(&text);
    assert_eq!(start, Some(NaiveDate::from_ymd_opt(2024, 3, 1).unwrap()));
    assert_eq!(end, Some(NaiveDate::from_ymd_opt(2024, 3, 31).unwrap()));
}
