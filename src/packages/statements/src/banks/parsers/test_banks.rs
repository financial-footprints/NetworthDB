use rust_decimal::Decimal;
use std::fs;
use std::path::PathBuf;

use super::federal::{FederalEdgeParser, FederalSignetParser};
use super::get_parser;
use super::icici::IciciStatementParser;

fn fixture_path(parts: &[&str]) -> PathBuf {
    let mut path = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    path.push("tests/fixtures");
    for part in parts {
        path.push(part);
    }
    path
}

#[test]
fn federal_signet_parses_sample() {
    let text =
        fs::read_to_string(fixture_path(&["federal", "signet", "sample.txt"])).expect("read");
    let rows = FederalSignetParser::parse(&text, "2021-04.pdf");
    assert_eq!(rows.len(), 2);
    assert_eq!(rows[0].debited, Decimal::new(10, 0));
    assert_eq!(rows[1].credited, Decimal::new(10, 0));
}

#[test]
fn federal_edge_parses_repayment_credit() {
    let text = fs::read_to_string(fixture_path(&["federal", "edge", "sample.txt"])).expect("read");
    let rows = FederalEdgeParser::parse(&text, "2021-01.pdf");
    assert_eq!(rows.len(), 4);
    let repayment = rows
        .iter()
        .find(|r| r.description.contains("Repayment"))
        .expect("repayment");
    assert_eq!(repayment.credited, Decimal::new(830, 0));
}

#[test]
fn icici_parses_amazon_txt() {
    let text = fs::read_to_string(fixture_path(&["icici", "amazon", "sample.txt"])).expect("read");
    let rows = IciciStatementParser::parse(&text, "2021-10.pdf");
    assert_eq!(rows.len(), 3);
    assert_eq!(rows[0].debited, Decimal::new(27550, 2));
    assert_eq!(rows[1].credited, Decimal::new(138000, 2));
    assert_eq!(rows[1].ref_no.as_deref(), Some("88472910562"));
}

#[test]
fn icici_parses_annual_csv() {
    let text =
        fs::read_to_string(fixture_path(&["icici", "csv", "annual-sample.csv"])).expect("read");
    let rows = IciciStatementParser::parse(&text, "yearly-sample.csv");
    assert_eq!(rows.len(), 9);
}

#[test]
fn pnb_platinum_parses_sample() {
    let text = fs::read_to_string(fixture_path(&["pnb", "platinum", "sample.txt"])).expect("read");
    let parser = get_parser("pnb", Some("platinum")).expect("parser");
    let rows = parser.parse(&text, "2021-05.pdf");
    assert!(!rows.is_empty());
}

#[test]
fn bob_easy_parses_format1() {
    let text = fs::read_to_string(fixture_path(&["bob", "easy", "format1.txt"])).expect("read");
    let parser = get_parser("bob", Some("easy")).expect("parser");
    let rows = parser.parse(&text, "2024-10.pdf");
    assert!(!rows.is_empty());
}
