//! Statement coverage and balance gap computation.

use chrono::{Datelike, Duration, NaiveDate};
use rust_decimal::Decimal;
use std::collections::HashSet;

use crate::banks::helpers::balances_match;
use crate::period::{is_annual_period, is_fy_period, period_for_year_key, YearDisplay};
use crate::pipeline::metadata::{CoverageGap, CoverageSegment, PeriodCovered, StatementMetadata};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BalanceGapStatus {
    Matched,
    Mismatched,
    Discontinuity,
}

impl BalanceGapStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            BalanceGapStatus::Matched => "matched",
            BalanceGapStatus::Mismatched => "mismatched",
            BalanceGapStatus::Discontinuity => "discontinuity",
        }
    }
}

pub fn covered_month(statement_date: &str) -> String {
    if is_annual_period(statement_date) {
        let year_display = if is_fy_period(statement_date) {
            YearDisplay::FiscalYear
        } else {
            YearDisplay::CalendarYear
        };
        let (start, _end) = period_for_year_key(statement_date, year_display);
        return format!("{:04}-{:02}", start.year(), start.month());
    }
    let parts: Vec<&str> = statement_date.split('-').collect();
    if parts.len() != 2 {
        return statement_date.to_string();
    }
    let year: i32 = parts[0].parse().unwrap_or(0);
    let month: u32 = parts[1].parse().unwrap_or(0);
    if month == 1 {
        return format!("{}-12", year - 1);
    }
    format!("{}-{:02}", year, month - 1)
}

pub fn next_month_key(month: &str) -> String {
    let parts: Vec<&str> = month.split('-').collect();
    if parts.len() != 2 {
        return month.to_string();
    }
    let year: i32 = parts[0].parse().unwrap_or(0);
    let month_num: u32 = parts[1].parse().unwrap_or(0);
    if month_num == 12 {
        return format!("{}-01", year + 1);
    }
    format!("{}-{:02}", year, month_num + 1)
}

pub fn months_between_exclusive(start: &str, end: &str) -> Vec<String> {
    if start >= end {
        return vec![];
    }
    let mut months = vec![];
    let mut current = next_month_key(start);
    while current.as_str() < end {
        months.push(current.clone());
        current = next_month_key(&current);
    }
    months
}

pub fn compute_balance_gaps(
    statements: &[StatementMetadata],
    tolerance: Option<Decimal>,
) -> Vec<(String, String)> {
    let annual_covered: HashSet<String> = statements
        .iter()
        .filter(|s| s.granularity == "annual")
        .flat_map(|s| s.covered_months.clone())
        .collect();

    let monthly_statements: Vec<&StatementMetadata> = statements
        .iter()
        .filter(|s| s.granularity == "monthly")
        .collect();
    if monthly_statements.len() < 2 {
        return vec![];
    }

    let mut sorted = monthly_statements;
    sorted.sort_by_key(|item| covered_month(&item.statement_date));

    let mut gaps = Vec::new();
    for index in 0..sorted.len() - 1 {
        let previous = sorted[index];
        let following = sorted[index + 1];
        let previous_covered = covered_month(&previous.statement_date);
        let following_covered = covered_month(&following.statement_date);
        let between = months_between_exclusive(&previous_covered, &following_covered);

        let closing = previous.closing_balance.as_deref();
        let opening = following.opening_balance.as_deref();
        if closing.is_none() || opening.is_none() {
            continue;
        }

        if !between.is_empty() {
            let status = if balances_match(closing.unwrap(), opening.unwrap(), tolerance) {
                BalanceGapStatus::Matched
            } else {
                BalanceGapStatus::Mismatched
            };
            for month in between {
                if !annual_covered.contains(&month) {
                    gaps.push((month, status.as_str().to_string()));
                }
            }
            continue;
        }

        if following_covered == next_month_key(&previous_covered)
            && !balances_match(closing.unwrap(), opening.unwrap(), tolerance)
        {
            gaps.push((
                previous_covered.clone(),
                BalanceGapStatus::Discontinuity.as_str().to_string(),
            ));
            gaps.push((
                following_covered.clone(),
                BalanceGapStatus::Discontinuity.as_str().to_string(),
            ));
        }
    }
    gaps
}

fn parse_account_date_value(value: &str) -> Option<NaiveDate> {
    if let Ok(date) = NaiveDate::parse_from_str(value, "%d-%m-%Y") {
        return Some(date);
    }
    NaiveDate::parse_from_str(value, "%Y-%m-%d").ok()
}

fn format_account_date(date: NaiveDate) -> String {
    format!("{:02}-{:02}-{:04}", date.day(), date.month(), date.year())
}

type CoveragePeriodRow = (NaiveDate, NaiveDate, bool);
type CoverageGapRow = (NaiveDate, NaiveDate);

fn merge_coverage_periods(
    periods: &[CoveragePeriodRow],
) -> (Vec<CoveragePeriodRow>, Vec<CoverageGapRow>) {
    if periods.is_empty() {
        return (vec![], vec![]);
    }
    let mut sorted = periods.to_vec();
    sorted.sort_by_key(|item| item.0);
    let mut segments = vec![];
    let mut gaps = vec![];
    let (mut current_start, mut current_end, mut current_approximate) = sorted[0];
    for (start, end, approximate) in sorted.into_iter().skip(1) {
        if start <= current_end + Duration::days(1) {
            if end > current_end {
                current_end = end;
            }
            current_approximate = current_approximate || approximate;
            continue;
        }
        segments.push((current_start, current_end, current_approximate));
        let gap_start = current_end + Duration::days(1);
        let gap_end = start - Duration::days(1);
        if gap_start <= gap_end {
            gaps.push((gap_start, gap_end));
        }
        current_start = start;
        current_end = end;
        current_approximate = approximate;
    }
    segments.push((current_start, current_end, current_approximate));
    (segments, gaps)
}

fn coverage_gap_balances_match(
    statements: &[StatementMetadata],
    segment_before_end: &str,
    segment_after_start: &str,
    tolerance: Option<Decimal>,
) -> Option<bool> {
    let monthly: Vec<&StatementMetadata> = statements
        .iter()
        .filter(|s| s.granularity == "monthly")
        .collect();
    let previous = monthly
        .iter()
        .find(|statement| statement.period_end.as_deref() == Some(segment_before_end));
    let after_start = parse_account_date_value(segment_after_start)?;
    let following = monthly
        .iter()
        .filter_map(|statement| {
            statement
                .period_start
                .as_deref()
                .and_then(parse_account_date_value)
                .filter(|start| *start >= after_start)
                .map(|start| (start, statement))
        })
        .min_by_key(|(start, _)| *start)
        .map(|(_, statement)| statement);
    if previous.is_none() || following.is_none() {
        return None;
    }
    let closing = previous.unwrap().closing_balance.as_deref();
    let opening = following.unwrap().opening_balance.as_deref();
    if closing.is_none() || opening.is_none() {
        return None;
    }
    Some(balances_match(
        closing.unwrap(),
        opening.unwrap(),
        tolerance,
    ))
}

pub fn build_period_covered(
    statements: &[StatementMetadata],
    tolerance: Option<Decimal>,
) -> PeriodCovered {
    let mut months: HashSet<String> = HashSet::new();
    for statement in statements {
        if statement.granularity == "monthly" {
            months.insert(covered_month(&statement.statement_date));
        }
        if statement.granularity == "annual" {
            for month in &statement.covered_months {
                months.insert(month.clone());
            }
        }
    }
    let mut months_vec: Vec<String> = months.into_iter().collect();
    months_vec.sort();

    let mut periods = vec![];
    let mut period_count = 0u32;
    for statement in statements {
        if statement.period_approximate {
            period_count += 1;
        }
        if let (Some(start), Some(end)) = (
            statement.period_start.as_deref(),
            statement.period_end.as_deref(),
        ) {
            if let (Some(start_date), Some(end_date)) = (
                parse_account_date_value(start),
                parse_account_date_value(end),
            ) {
                periods.push((start_date, end_date, statement.period_approximate));
            }
        }
    }

    if periods.is_empty() {
        return PeriodCovered {
            start: None,
            end: None,
            segments: vec![],
            gaps: vec![],
            months: months_vec,
            period_count,
        };
    }

    let (merged_segments, merged_gaps) = merge_coverage_periods(&periods);
    let segments: Vec<CoverageSegment> = merged_segments
        .iter()
        .map(|(start, end, approximate)| CoverageSegment {
            start: format_account_date(*start),
            end: format_account_date(*end),
            approximate: *approximate,
        })
        .collect();

    let gaps: Vec<CoverageGap> = merged_gaps
        .iter()
        .enumerate()
        .map(|(index, (start, end))| {
            let balances_match = coverage_gap_balances_match(
                statements,
                &format_account_date(merged_segments[index].1),
                &format_account_date(merged_segments[index + 1].0),
                tolerance,
            );
            CoverageGap {
                start: format_account_date(*start),
                end: format_account_date(*end),
                balances_match,
            }
        })
        .collect();

    PeriodCovered {
        start: segments.first().map(|s| s.start.clone()),
        end: segments.last().map(|s| s.end.clone()),
        segments,
        gaps,
        months: months_vec,
        period_count,
    }
}
