use chrono::NaiveDate;
use rust_decimal::Decimal;
use std::fs;
use std::path::PathBuf;

use super::onecard::OnecardStatementParser;

fn fixture_path(name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures/onecard/default")
        .join(name)
}

#[test]
fn parses_sample_transactions() {
    let text = fs::read_to_string(fixture_path("sample.txt")).expect("read");
    let rows = OnecardStatementParser::parse(&text, "2021-09.pdf");
    assert_eq!(rows.len(), 5);
    let debits = rows.iter().filter(|r| r.debited > Decimal::ZERO).count();
    let credits = rows.iter().filter(|r| r.credited > Decimal::ZERO).count();
    assert_eq!(debits, 4);
    assert_eq!(credits, 1);
    assert_eq!(rows[0].debited, Decimal::new(75, 0));
    assert_eq!(rows[0].date, NaiveDate::from_ymd_opt(2021, 7, 30).unwrap());
    let credit = rows
        .iter()
        .find(|r| r.credited > Decimal::ZERO)
        .expect("credit");
    assert_eq!(credit.credited, Decimal::new(1200, 0));
    assert!(credit.description.contains("REPAY"));
}

#[test]
fn empty_history_returns_no_rows() {
    let text = fs::read_to_string(fixture_path("empty.txt")).expect("read");
    let rows = OnecardStatementParser::parse(&text, "2024-04.pdf");
    assert!(rows.is_empty());
}
