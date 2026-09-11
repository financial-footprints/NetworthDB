use chrono::NaiveDate;

use super::{approx_start_from_end, BillingCycle, BillingPeriod};

#[test]
fn example_anchor_day_17() {
    let cycle = BillingCycle::new(17).unwrap();
    assert_eq!(
        cycle.period_containing(NaiveDate::from_ymd_opt(2023, 5, 17).unwrap()),
        BillingPeriod {
            start: NaiveDate::from_ymd_opt(2023, 5, 17).unwrap(),
            end: NaiveDate::from_ymd_opt(2023, 6, 16).unwrap(),
        }
    );
    assert_eq!(
        cycle.period_containing(NaiveDate::from_ymd_opt(2023, 4, 17).unwrap()),
        BillingPeriod {
            start: NaiveDate::from_ymd_opt(2023, 4, 17).unwrap(),
            end: NaiveDate::from_ymd_opt(2023, 5, 16).unwrap(),
        }
    );
    assert_eq!(
        cycle.period_containing(NaiveDate::from_ymd_opt(2023, 3, 17).unwrap()),
        BillingPeriod {
            start: NaiveDate::from_ymd_opt(2023, 3, 17).unwrap(),
            end: NaiveDate::from_ymd_opt(2023, 4, 16).unwrap(),
        }
    );
    assert_eq!(
        cycle.period_containing(NaiveDate::from_ymd_opt(2023, 2, 20).unwrap()),
        BillingPeriod {
            start: NaiveDate::from_ymd_opt(2023, 2, 17).unwrap(),
            end: NaiveDate::from_ymd_opt(2023, 3, 16).unwrap(),
        }
    );
    assert_eq!(
        cycle.period_containing(NaiveDate::from_ymd_opt(2023, 3, 16).unwrap()),
        BillingPeriod {
            start: NaiveDate::from_ymd_opt(2023, 2, 17).unwrap(),
            end: NaiveDate::from_ymd_opt(2023, 3, 16).unwrap(),
        }
    );
}

#[test]
fn example_anchor_day_1_calendar_months() {
    let cycle = BillingCycle::new(1).unwrap();
    assert_eq!(
        cycle.period_containing(NaiveDate::from_ymd_opt(2001, 1, 1).unwrap()),
        BillingPeriod {
            start: NaiveDate::from_ymd_opt(2001, 1, 1).unwrap(),
            end: NaiveDate::from_ymd_opt(2001, 1, 31).unwrap(),
        }
    );
    assert_eq!(
        cycle.period_containing(NaiveDate::from_ymd_opt(2001, 2, 28).unwrap()),
        BillingPeriod {
            start: NaiveDate::from_ymd_opt(2001, 2, 1).unwrap(),
            end: NaiveDate::from_ymd_opt(2001, 2, 28).unwrap(),
        }
    );
}

#[test]
fn example_anchor_day_9() {
    let cycle = BillingCycle::new(9).unwrap();
    assert_eq!(
        cycle.period_containing(NaiveDate::from_ymd_opt(2026, 9, 9).unwrap()),
        BillingPeriod {
            start: NaiveDate::from_ymd_opt(2026, 9, 9).unwrap(),
            end: NaiveDate::from_ymd_opt(2026, 10, 8).unwrap(),
        }
    );
}

#[test]
fn from_opening_date() {
    let cycle =
        BillingCycle::from_opening_date(NaiveDate::from_ymd_opt(2023, 5, 17).unwrap()).unwrap();
    assert_eq!(cycle.anchor_day(), 17);
}

#[test]
fn invalid_anchor_day() {
    assert!(BillingCycle::new(0).is_err());
    assert!(BillingCycle::new(32).is_err());
}

#[test]
fn anchor_day_31_clamped_in_short_month() {
    let cycle = BillingCycle::new(31).unwrap();
    let period = cycle.period_containing(NaiveDate::from_ymd_opt(2024, 2, 15).unwrap());
    assert_eq!(period.start, NaiveDate::from_ymd_opt(2024, 1, 31).unwrap());
    assert_eq!(period.end, NaiveDate::from_ymd_opt(2024, 2, 29).unwrap());

    let period = cycle.period_containing(NaiveDate::from_ymd_opt(2025, 2, 10).unwrap());
    assert_eq!(period.start, NaiveDate::from_ymd_opt(2025, 1, 31).unwrap());
    assert_eq!(period.end, NaiveDate::from_ymd_opt(2025, 2, 28).unwrap());
}

#[test]
fn approx_start_from_end_cases() {
    assert_eq!(
        approx_start_from_end(NaiveDate::from_ymd_opt(2025, 1, 31).unwrap()),
        NaiveDate::from_ymd_opt(2025, 1, 1).unwrap()
    );
    assert_eq!(
        approx_start_from_end(NaiveDate::from_ymd_opt(2023, 6, 16).unwrap()),
        NaiveDate::from_ymd_opt(2023, 5, 17).unwrap()
    );
}

#[test]
fn end_month_key() {
    let cycle = BillingCycle::new(17).unwrap();
    let period = BillingPeriod {
        start: NaiveDate::from_ymd_opt(2023, 5, 17).unwrap(),
        end: NaiveDate::from_ymd_opt(2023, 6, 16).unwrap(),
    };
    assert_eq!(cycle.end_month_key(&period), "2023-06");
}

#[test]
fn distinct_periods() {
    let cycle = BillingCycle::new(17).unwrap();
    assert_eq!(
        cycle
            .distinct_periods(&[
                NaiveDate::from_ymd_opt(2023, 5, 20).unwrap(),
                NaiveDate::from_ymd_opt(2023, 6, 1).unwrap(),
                NaiveDate::from_ymd_opt(2023, 6, 16).unwrap(),
            ])
            .len(),
        1
    );
    assert_eq!(
        cycle
            .distinct_periods(&[
                NaiveDate::from_ymd_opt(2023, 5, 20).unwrap(),
                NaiveDate::from_ymd_opt(2023, 6, 17).unwrap(),
            ])
            .len(),
        2
    );
}

#[test]
fn bounds_for_transactions() {
    let cycle = BillingCycle::new(17).unwrap();
    let bounds = cycle
        .bounds_for_transactions(&[
            NaiveDate::from_ymd_opt(2023, 5, 20).unwrap(),
            NaiveDate::from_ymd_opt(2023, 6, 20).unwrap(),
        ])
        .unwrap();
    assert_eq!(bounds.start, NaiveDate::from_ymd_opt(2023, 5, 17).unwrap());
    assert_eq!(bounds.end, NaiveDate::from_ymd_opt(2023, 7, 16).unwrap());
}

#[test]
fn bounds_for_transactions_empty() {
    let cycle = BillingCycle::new(17).unwrap();
    assert!(cycle.bounds_for_transactions(&[]).is_err());
}

#[test]
fn billing_period_rejects_inverted_range() {
    assert!(BillingPeriod::new(
        NaiveDate::from_ymd_opt(2023, 6, 1).unwrap(),
        NaiveDate::from_ymd_opt(2023, 5, 1).unwrap()
    )
    .is_err());
}
