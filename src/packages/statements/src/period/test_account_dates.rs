use crate::domain::Account;
use chrono::NaiveDate;

use super::{incremental_fetch_start, resolve_account_search_dates};

fn sample_account(opening: &str, closing: Option<&str>) -> Account {
    Account {
        id: "acc-1".to_string(),
        user_id: "user-1".to_string(),
        bank: "onecard".to_string(),
        variant: None,
        label: "onecard".to_string(),
        account_type: "credit_card".to_string(),
        opening_date: opening.to_string(),
        closing_date: closing.map(|s| s.to_string()),
        account_number: String::new(),
        passwords: vec![],
        mail: None,
        statement: None,
        created_at: String::new(),
        updated_at: String::new(),
    }
}

#[test]
fn incremental_fetch_start_minus_one_day() {
    let last = NaiveDate::from_ymd_opt(2026, 1, 20).unwrap();
    let start = incremental_fetch_start(Some(last)).unwrap();
    assert_eq!(start, NaiveDate::from_ymd_opt(2026, 1, 19).unwrap());
}

#[test]
fn resolve_search_dates_uses_opening_and_incremental() {
    let account = sample_account("2020-01-01", Some("31-12-2026"));
    let last = NaiveDate::from_ymd_opt(2026, 1, 20).unwrap();
    let (start, end) = resolve_account_search_dates(&account, Some(last));
    assert_eq!(start, Some(NaiveDate::from_ymd_opt(2026, 1, 19).unwrap()));
    assert_eq!(end, Some(NaiveDate::from_ymd_opt(2027, 1, 1).unwrap()));
}
