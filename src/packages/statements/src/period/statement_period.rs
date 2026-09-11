use chrono::{Datelike, NaiveDate};
use regex::Regex;
use std::path::Path;
use std::sync::LazyLock;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum YearDisplay {
    FiscalYear,
    CalendarYear,
}

static MONTH_PERIOD_PATTERN: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^(\d{4}-\d{2})$").expect("month period regex"));
static FILENAME_MONTH_PATTERN: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(\d{4}-\d{2})(?:-\d{2})?").expect("filename month regex"));
static STAGING_EMAIL_DATE_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"__(\d{4}-\d{2}-\d{2})(?:__annual)?(?:\s+\(\d+\))?\.(?:pdf|csv)$")
        .expect("staging email date regex")
});
static FISCAL_YEAR_KEY_PATTERN: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^FY(\d{2})-(\d{4})$").expect("fy key regex"));
static CALENDAR_YEAR_KEY_PATTERN: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^(\d{4})$").expect("calendar year regex"));

fn month_names() -> [(&'static str, u32); 12] {
    [
        ("january", 1),
        ("february", 2),
        ("march", 3),
        ("april", 4),
        ("may", 5),
        ("june", 6),
        ("july", 7),
        ("august", 8),
        ("september", 9),
        ("october", 10),
        ("november", 11),
        ("december", 12),
    ]
}

pub fn parse_month_period(period: &str) -> Option<&str> {
    if MONTH_PERIOD_PATTERN.is_match(period) {
        let month: u32 = period[5..].parse().unwrap_or(0);
        if (1..=12).contains(&month) {
            return Some(period);
        }
    }
    None
}

pub fn is_fy_period(period: &str) -> bool {
    FISCAL_YEAR_KEY_PATTERN.is_match(period)
}

pub fn is_calendar_year_period(period: &str) -> bool {
    CALENDAR_YEAR_KEY_PATTERN.is_match(period)
}

pub fn is_annual_period(period: &str) -> bool {
    is_fy_period(period) || is_calendar_year_period(period)
}

pub fn month_period_from_filename(filename: &str) -> String {
    if let Some(caps) = FILENAME_MONTH_PATTERN.captures(filename) {
        return caps
            .get(1)
            .map(|m| m.as_str().to_string())
            .unwrap_or_else(|| "unknown-month".to_string());
    }
    "unknown-month".to_string()
}

pub fn email_date_from_staging_filename(filename: &str) -> Option<NaiveDate> {
    let name = Path::new(filename)
        .file_name()
        .map(|n| n.to_string_lossy())
        .unwrap_or_default();
    let caps = STAGING_EMAIL_DATE_PATTERN.captures(&name)?;
    let date_str = caps.get(1)?.as_str();
    NaiveDate::parse_from_str(date_str, "%Y-%m-%d").ok()
}

#[cfg(test)]
pub fn staging_filename_is_annual(filename: &str) -> bool {
    let name = Path::new(filename)
        .file_name()
        .map(|n| n.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    name.contains("__annual.") || name.contains("__annual ")
}

#[cfg(test)]
fn last_day_of_month(year: i32, month: u32) -> u32 {
    let (next_year, next_month) = if month == 12 {
        (year + 1, 1)
    } else {
        (year, month + 1)
    };
    NaiveDate::from_ymd_opt(next_year, next_month, 1)
        .unwrap()
        .pred_opt()
        .map(|d| d.day())
        .unwrap_or(28)
}

#[cfg(test)]
pub fn fy_period_bounds(fy_key: &str, year_display: YearDisplay) -> (NaiveDate, NaiveDate) {
    period_for_year_key(fy_key, year_display)
}

#[cfg(test)]
pub fn calendar_bounds_for_period_key(period: &str) -> Option<(NaiveDate, NaiveDate)> {
    if let Some(month_period) = parse_month_period(period) {
        let parts: Vec<&str> = month_period.split('-').collect();
        let year: i32 = parts[0].parse().unwrap_or(0);
        let month: u32 = parts[1].parse().unwrap_or(0);
        let last = last_day_of_month(year, month);
        return Some((
            NaiveDate::from_ymd_opt(year, month, 1).unwrap(),
            NaiveDate::from_ymd_opt(year, month, last).unwrap(),
        ));
    }

    if is_fy_period(period) {
        return Some(period_for_year_key(period, YearDisplay::FiscalYear));
    }
    if is_calendar_year_period(period) {
        return Some(period_for_year_key(period, YearDisplay::CalendarYear));
    }
    None
}

pub fn fiscal_year_key_from_month_key(month_key: &str) -> String {
    let parts: Vec<&str> = month_key.split('-').collect();
    if parts.len() != 2 {
        return "unknown-month".to_string();
    }
    let year: i32 = parts[0].parse().unwrap_or(0);
    let month: i32 = parts[1].parse().unwrap_or(0);
    let (fy_start, fy_end) = if month >= 4 {
        (year, year + 1)
    } else {
        (year - 1, year)
    };
    format!("FY{:02}-{}", fy_start.rem_euclid(100), fy_end)
}

pub fn covered_months_between(start: NaiveDate, end: NaiveDate) -> Vec<String> {
    if end < start {
        return vec![];
    }
    let mut months = vec![];
    let mut current = NaiveDate::from_ymd_opt(start.year(), start.month(), 1).unwrap();
    let end_month = NaiveDate::from_ymd_opt(end.year(), end.month(), 1).unwrap();
    while current <= end_month {
        months.push(format!("{:04}-{:02}", current.year(), current.month()));
        current = if current.month() == 12 {
            NaiveDate::from_ymd_opt(current.year() + 1, 1, 1).unwrap()
        } else {
            NaiveDate::from_ymd_opt(current.year(), current.month() + 1, 1).unwrap()
        };
    }
    months
}

pub fn fiscal_year_key(start: NaiveDate, _end: NaiveDate) -> String {
    let fy_start = if start.month() >= 4 {
        start.year()
    } else {
        start.year() - 1
    };
    let fy_end = fy_start + 1;
    format!("FY{:02}-{}", fy_start.rem_euclid(100), fy_end)
}

pub fn fy_key_from_dates(start: NaiveDate, end: NaiveDate) -> String {
    let (start, end) = if end < start {
        (end, start)
    } else {
        (start, end)
    };
    let months = covered_months_between(start, end);
    if months.is_empty() {
        return fiscal_year_key(start, end);
    }
    let mut fy_counts: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    for month_key in &months {
        let fy = fiscal_year_key_from_month_key(month_key);
        *fy_counts.entry(fy).or_insert(0) += 1;
    }
    fy_counts
        .into_iter()
        .max_by_key(|(_, count)| *count)
        .map(|(fy, _)| fy)
        .unwrap_or_else(|| fiscal_year_key(start, end))
}

#[cfg(test)]
pub fn year_key_label(year_key: &str, year_display: YearDisplay) -> String {
    if year_display == YearDisplay::FiscalYear {
        if let Some(caps) = FISCAL_YEAR_KEY_PATTERN.captures(year_key) {
            let start_yy: i32 = caps[1].parse().unwrap_or(0);
            let end_year: i32 = caps[2].parse().unwrap_or(0);
            let mut start_year = (end_year / 100) * 100 + start_yy;
            if start_year >= end_year {
                start_year -= 100;
            }
            return format!("FY {}–{}", start_year, end_year);
        }
    }
    year_key.to_string()
}

pub fn period_for_year_key(year_key: &str, year_display: YearDisplay) -> (NaiveDate, NaiveDate) {
    if year_display == YearDisplay::FiscalYear {
        let caps = FISCAL_YEAR_KEY_PATTERN
            .captures(year_key)
            .ok_or_else(|| format!("invalid fiscal year key: {:?}", year_key))
            .unwrap();
        let start_yy: i32 = caps[1].parse().unwrap();
        let end_year: i32 = caps[2].parse().unwrap();
        let mut start_year = (end_year / 100) * 100 + start_yy;
        if start_year >= end_year {
            start_year -= 100;
        }
        return (
            NaiveDate::from_ymd_opt(start_year, 4, 1).unwrap(),
            NaiveDate::from_ymd_opt(end_year, 3, 31).unwrap(),
        );
    }
    let caps = CALENDAR_YEAR_KEY_PATTERN
        .captures(year_key)
        .ok_or_else(|| format!("invalid calendar year key: {:?}", year_key))
        .unwrap();
    let year: i32 = caps[1].parse().unwrap();
    (
        NaiveDate::from_ymd_opt(year, 1, 1).unwrap(),
        NaiveDate::from_ymd_opt(year, 12, 31).unwrap(),
    )
}

pub fn parse_month_year_token(token: &str) -> Option<(i32, u32)> {
    let cleaned = token.trim().to_uppercase();
    if !cleaned.contains('-') {
        return None;
    }
    let (month_name, year_part) = cleaned.rsplit_once('-')?;
    let month = month_names()
        .iter()
        .find(|(name, _)| month_name.eq_ignore_ascii_case(name))
        .map(|(_, m)| *m)?;
    let year = if year_part.len() == 2 && year_part.chars().all(|c| c.is_ascii_digit()) {
        2000 + year_part.parse::<i32>().unwrap_or(0)
    } else if year_part.len() == 4 && year_part.chars().all(|c| c.is_ascii_digit()) {
        year_part.parse().ok()?
    } else {
        return None;
    };
    Some((year, month))
}

pub fn annual_file_stem(statement_period: &str) -> String {
    if is_calendar_year_period(statement_period) {
        return statement_period.to_string();
    }
    if let Some(caps) = FISCAL_YEAR_KEY_PATTERN.captures(statement_period) {
        return caps[2].to_string();
    }
    statement_period.to_string()
}

pub fn statement_basename(statement_period: &str) -> String {
    if is_annual_period(statement_period) {
        annual_file_stem(statement_period)
    } else {
        statement_period.to_string()
    }
}

#[cfg(test)]
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CalendarMonthCell {
    pub month: u32,
    pub year: i32,
    pub month_key: String,
}

#[cfg(test)]
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CalendarYearSection {
    pub year_key: String,
    pub label: String,
    pub months: Vec<CalendarMonthCell>,
}

#[cfg(test)]
fn year_key_for_month_key(month_key: &str, year_display: YearDisplay) -> String {
    if year_display == YearDisplay::FiscalYear {
        return fiscal_year_key_from_month_key(month_key);
    }
    month_key.split('-').next().unwrap_or(month_key).to_string()
}

#[cfg(test)]
fn month_cell(month_key: &str) -> CalendarMonthCell {
    let parts: Vec<&str> = month_key.split('-').collect();
    CalendarMonthCell {
        year: parts[0].parse().unwrap_or(0),
        month: parts[1].parse().unwrap_or(0),
        month_key: month_key.to_string(),
    }
}

#[cfg(test)]
pub fn build_calendar_year_sections(
    start: NaiveDate,
    end: NaiveDate,
    year_display: YearDisplay,
) -> Vec<CalendarYearSection> {
    if end < start {
        return vec![];
    }

    let mut year_keys = vec![];
    let mut seen = std::collections::HashSet::new();
    for month_key in covered_months_between(start, end) {
        let year_key = year_key_for_month_key(&month_key, year_display);
        if seen.insert(year_key.clone()) {
            year_keys.push(year_key);
        }
    }
    year_keys.reverse();

    year_keys
        .into_iter()
        .map(|year_key| {
            let (period_start, period_end) = period_for_year_key(&year_key, year_display);
            let months = covered_months_between(period_start, period_end)
                .into_iter()
                .rev()
                .map(|mk| month_cell(&mk))
                .collect();
            CalendarYearSection {
                year_key: year_key.clone(),
                label: year_key_label(&year_key, year_display),
                months,
            }
        })
        .collect()
}
