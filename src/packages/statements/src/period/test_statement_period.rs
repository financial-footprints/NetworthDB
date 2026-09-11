use chrono::NaiveDate;

use super::{
    build_calendar_year_sections, calendar_bounds_for_period_key, covered_months_between,
    email_date_from_staging_filename, fiscal_year_key, fiscal_year_key_from_month_key,
    fy_key_from_dates, fy_period_bounds, is_annual_period, is_fy_period, parse_month_period,
    period_for_year_key, staging_filename_is_annual, statement_basename, YearDisplay,
};

#[test]
fn parse_month_period_valid() {
    assert_eq!(parse_month_period("2024-01"), Some("2024-01"));
    assert_eq!(parse_month_period("2024-13"), None);
}

#[test]
fn fiscal_year_from_month() {
    assert_eq!(fiscal_year_key_from_month_key("2024-01"), "FY23-2024");
    assert_eq!(fiscal_year_key_from_month_key("2024-04"), "FY24-2025");
}

#[test]
fn annual_basename() {
    assert_eq!(statement_basename("FY24-2025"), "2025");
    assert_eq!(statement_basename("2024"), "2024");
    assert_eq!(statement_basename("2024-01"), "2024-01");
}

#[test]
fn is_fy_and_annual() {
    assert!(is_fy_period("FY24-2025"));
    assert!(is_annual_period("2024"));
}

#[test]
fn email_date_from_staging_filename_cases() {
    assert_eq!(
        email_date_from_staging_filename("Important__2023-02-18.pdf"),
        Some(NaiveDate::from_ymd_opt(2023, 2, 18).unwrap())
    );
    assert_eq!(
        email_date_from_staging_filename("INBOX__2023-02-15 (1).pdf"),
        Some(NaiveDate::from_ymd_opt(2023, 2, 15).unwrap())
    );
    assert_eq!(
        email_date_from_staging_filename("INBOX__2024-05-12__annual.csv"),
        Some(NaiveDate::from_ymd_opt(2024, 5, 12).unwrap())
    );
    assert_eq!(
        email_date_from_staging_filename("INBOX__2024-05-12.csv"),
        Some(NaiveDate::from_ymd_opt(2024, 5, 12).unwrap())
    );
    assert_eq!(
        email_date_from_staging_filename("manual__2023-02.pdf"),
        None
    );
    assert_eq!(email_date_from_staging_filename("attachment.pdf"), None);
}

#[test]
fn staging_filename_is_annual_cases() {
    assert!(staging_filename_is_annual("INBOX__2024-05-12__annual.csv"));
    assert!(!staging_filename_is_annual("INBOX__2024-05-12.csv"));
}

#[test]
fn fy_period_round_trip() {
    let period = "FY24-2025";
    assert!(is_fy_period(period));
    assert!(is_annual_period(period));
    assert_eq!(
        fy_period_bounds(period, YearDisplay::FiscalYear),
        (
            NaiveDate::from_ymd_opt(2024, 4, 1).unwrap(),
            NaiveDate::from_ymd_opt(2025, 3, 31).unwrap()
        )
    );
}

#[test]
fn calendar_bounds_for_period_key_cases() {
    assert_eq!(
        calendar_bounds_for_period_key("2026-04"),
        Some((
            NaiveDate::from_ymd_opt(2026, 4, 1).unwrap(),
            NaiveDate::from_ymd_opt(2026, 4, 30).unwrap()
        ))
    );
    assert_eq!(
        calendar_bounds_for_period_key("FY25-2026"),
        Some((
            NaiveDate::from_ymd_opt(2025, 4, 1).unwrap(),
            NaiveDate::from_ymd_opt(2026, 3, 31).unwrap()
        ))
    );
    assert_eq!(calendar_bounds_for_period_key("unknown-month"), None);
}

#[test]
fn fiscal_year_key_from_dates() {
    assert_eq!(
        fiscal_year_key(
            NaiveDate::from_ymd_opt(2024, 4, 1).unwrap(),
            NaiveDate::from_ymd_opt(2025, 3, 31).unwrap()
        ),
        "FY24-2025"
    );
}

#[test]
fn fy_key_from_dates_majority_months() {
    let cases = [
        (
            NaiveDate::from_ymd_opt(2022, 8, 1).unwrap(),
            NaiveDate::from_ymd_opt(2023, 2, 28).unwrap(),
            "FY22-2023",
        ),
        (
            NaiveDate::from_ymd_opt(2023, 4, 1).unwrap(),
            NaiveDate::from_ymd_opt(2024, 3, 31).unwrap(),
            "FY23-2024",
        ),
        (
            NaiveDate::from_ymd_opt(2024, 3, 17).unwrap(),
            NaiveDate::from_ymd_opt(2024, 5, 16).unwrap(),
            "FY24-2025",
        ),
        (
            NaiveDate::from_ymd_opt(2025, 3, 17).unwrap(),
            NaiveDate::from_ymd_opt(2026, 3, 16).unwrap(),
            "FY25-2026",
        ),
    ];
    for (start, end, expected) in cases {
        assert_eq!(fy_key_from_dates(start, end), expected);
    }
}

#[test]
fn period_for_year_keys() {
    let (start, end) = period_for_year_key("FY24-2025", YearDisplay::FiscalYear);
    assert_eq!(start, NaiveDate::from_ymd_opt(2024, 4, 1).unwrap());
    assert_eq!(end, NaiveDate::from_ymd_opt(2025, 3, 31).unwrap());

    let (start, end) = period_for_year_key("2024", YearDisplay::CalendarYear);
    assert_eq!(start, NaiveDate::from_ymd_opt(2024, 1, 1).unwrap());
    assert_eq!(end, NaiveDate::from_ymd_opt(2024, 12, 31).unwrap());
}

#[test]
fn covered_months_between_range() {
    assert_eq!(
        covered_months_between(
            NaiveDate::from_ymd_opt(2024, 4, 1).unwrap(),
            NaiveDate::from_ymd_opt(2024, 6, 30).unwrap()
        ),
        vec!["2024-04", "2024-05", "2024-06"]
    );
}

#[test]
fn build_calendar_year_sections_calendar_year() {
    let sections = build_calendar_year_sections(
        NaiveDate::from_ymd_opt(2023, 4, 1).unwrap(),
        NaiveDate::from_ymd_opt(2024, 12, 1).unwrap(),
        YearDisplay::CalendarYear,
    );
    assert_eq!(
        sections
            .iter()
            .map(|s| s.year_key.as_str())
            .collect::<Vec<_>>(),
        vec!["2024", "2023"]
    );
    assert_eq!(sections[0].months.len(), 12);
    assert_eq!(sections[1].months.len(), 12);
    assert_eq!(sections[0].months[0].month_key, "2024-12");
    assert_eq!(sections[0].months[11].month_key, "2024-01");
    assert_eq!(sections[1].months[0].month_key, "2023-12");
    assert_eq!(sections[1].months[11].month_key, "2023-01");
}

#[test]
fn build_calendar_year_sections_fiscal_year() {
    let sections = build_calendar_year_sections(
        NaiveDate::from_ymd_opt(2024, 2, 1).unwrap(),
        NaiveDate::from_ymd_opt(2024, 8, 1).unwrap(),
        YearDisplay::FiscalYear,
    );
    assert_eq!(
        sections
            .iter()
            .map(|s| s.year_key.as_str())
            .collect::<Vec<_>>(),
        vec!["FY24-2025", "FY23-2024"]
    );
    assert_eq!(sections[0].months[0].month_key, "2025-03");
    assert_eq!(sections[0].months.last().unwrap().month_key, "2024-04");
    assert_eq!(sections[1].months[0].month_key, "2024-03");
    assert_eq!(sections[1].months.last().unwrap().month_key, "2023-04");
}

#[test]
fn build_calendar_year_sections_fiscal_label() {
    let sections = build_calendar_year_sections(
        NaiveDate::from_ymd_opt(2023, 4, 1).unwrap(),
        NaiveDate::from_ymd_opt(2023, 6, 1).unwrap(),
        YearDisplay::FiscalYear,
    );
    assert_eq!(sections.len(), 1);
    assert_eq!(sections[0].label, "FY 2023–2024");
}

#[test]
fn build_calendar_year_sections_invalid_range() {
    assert!(build_calendar_year_sections(
        NaiveDate::from_ymd_opt(2024, 12, 1).unwrap(),
        NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(),
        YearDisplay::CalendarYear,
    )
    .is_empty());
}
