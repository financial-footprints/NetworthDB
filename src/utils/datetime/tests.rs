#[cfg(test)]
use crate::utils::datetime::{date_str_to_datetime, get_current_datetime};
use sea_orm::sqlx::types::chrono::{TimeZone, Utc};

#[test]
fn test_date_str_to_datetime() {
    let date = "01/01/2023";
    let expected = Utc.with_ymd_and_hms(2023, 1, 1, 0, 0, 0).unwrap();
    assert_eq!(date_str_to_datetime(date), expected);

    let date_with_spaces = "  01/01/2023  ";
    assert_eq!(date_str_to_datetime(date_with_spaces), expected);
}

#[test]
#[should_panic(expected = "error.utils.datetime.date_str_to_datetime")]
fn test_date_str_to_datetime_invalid_format() {
    date_str_to_datetime("2023-01-01");
}

#[test]
fn test_get_current_datetime() {
    let before = Utc::now();
    let current = get_current_datetime();
    let after = Utc::now();

    assert!(current >= before);
    assert!(current <= after);
}
