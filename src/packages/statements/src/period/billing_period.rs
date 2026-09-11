use chrono::{Datelike, Duration, NaiveDate};

#[cfg(test)]
use std::collections::HashSet;

fn clamp_day(year: i32, month: u32, day: u32) -> u32 {
    let last = NaiveDate::from_ymd_opt(year, month + 1, 1)
        .unwrap_or_else(|| NaiveDate::from_ymd_opt(year + 1, 1, 1).unwrap())
        .pred_opt()
        .map(|d| d.day())
        .unwrap_or(28);
    day.min(last)
}

fn add_months(year: i32, month: u32, delta: i32) -> (i32, u32) {
    let shifted = month as i32 - 1 + delta;
    (
        year + shifted.div_euclid(12),
        (shifted.rem_euclid(12) + 1) as u32,
    )
}

pub fn approx_start_from_end(end: NaiveDate) -> NaiveDate {
    let (prev_year, prev_month) = add_months(end.year(), end.month(), -1);
    let prev_day = clamp_day(prev_year, prev_month, end.day());
    NaiveDate::from_ymd_opt(prev_year, prev_month, prev_day).unwrap() + Duration::days(1)
}

#[cfg(test)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct BillingPeriod {
    pub start: NaiveDate,
    pub end: NaiveDate,
}

#[cfg(test)]
impl BillingPeriod {
    pub fn new(start: NaiveDate, end: NaiveDate) -> Result<Self, String> {
        if start > end {
            return Err(format!(
                "billing period start {} is after end {}",
                start, end
            ));
        }
        Ok(Self { start, end })
    }
}

#[cfg(test)]
pub struct BillingCycle {
    anchor_day: u32,
}

#[cfg(test)]
impl BillingCycle {
    pub fn new(anchor_day: u32) -> Result<Self, String> {
        if !(1..=31).contains(&anchor_day) {
            return Err(format!("anchor_day must be 1..31, got {}", anchor_day));
        }
        Ok(Self { anchor_day })
    }

    pub fn anchor_day(&self) -> u32 {
        self.anchor_day
    }

    pub fn from_opening_date(opening_date: NaiveDate) -> Result<Self, String> {
        Self::new(opening_date.day())
    }

    pub fn period_containing(&self, txn_date: NaiveDate) -> BillingPeriod {
        if self.anchor_day == 1 {
            let last = clamp_day(txn_date.year(), txn_date.month(), 31);
            return BillingPeriod {
                start: NaiveDate::from_ymd_opt(txn_date.year(), txn_date.month(), 1).unwrap(),
                end: NaiveDate::from_ymd_opt(txn_date.year(), txn_date.month(), last).unwrap(),
            };
        }

        let day_in_month = clamp_day(txn_date.year(), txn_date.month(), self.anchor_day);
        let (start_year, start_month) = if txn_date.day() >= day_in_month {
            (txn_date.year(), txn_date.month())
        } else {
            add_months(txn_date.year(), txn_date.month(), -1)
        };

        let start_day = clamp_day(start_year, start_month, self.anchor_day);
        let start = NaiveDate::from_ymd_opt(start_year, start_month, start_day).unwrap();
        let (end_year, end_month) = add_months(start_year, start_month, 1);
        let end_day = clamp_day(end_year, end_month, self.anchor_day - 1);
        BillingPeriod {
            start,
            end: NaiveDate::from_ymd_opt(end_year, end_month, end_day).unwrap(),
        }
    }

    pub fn end_month_key(&self, period: &BillingPeriod) -> String {
        format!("{:04}-{:02}", period.end.year(), period.end.month())
    }

    pub fn distinct_periods(&self, txn_dates: &[NaiveDate]) -> Vec<BillingPeriod> {
        let mut seen = HashSet::new();
        let mut periods = vec![];
        for txn_date in txn_dates {
            let period = self.period_containing(*txn_date);
            if seen.insert(period) {
                periods.push(period);
            }
        }
        periods
    }

    pub fn bounds_for_transactions(
        &self,
        txn_dates: &[NaiveDate],
    ) -> Result<BillingPeriod, String> {
        let periods = self.distinct_periods(txn_dates);
        if periods.is_empty() {
            return Err("txn_dates must not be empty".to_string());
        }
        Ok(BillingPeriod {
            start: periods.iter().map(|p| p.start).min().unwrap(),
            end: periods.iter().map(|p| p.end).max().unwrap(),
        })
    }
}
