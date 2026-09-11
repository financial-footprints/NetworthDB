//! Vault JSON shapes for account metadata persistence (not public domain types).

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatementMetadata {
    pub statement_date: String,
    pub formats: Vec<String>,
    pub opening_balance: Option<String>,
    pub closing_balance: Option<String>,
    pub period_start: Option<String>,
    pub period_end: Option<String>,
    pub period_approximate: bool,
    pub granularity: String,
    pub covered_months: Vec<String>,
    pub year_key: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoverageSegment {
    pub start: String,
    pub end: String,
    pub approximate: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoverageGap {
    pub start: String,
    pub end: String,
    pub balances_match: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeriodCovered {
    pub start: Option<String>,
    pub end: Option<String>,
    pub segments: Vec<CoverageSegment>,
    pub gaps: Vec<CoverageGap>,
    pub months: Vec<String>,
    pub period_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredAccountMetadata {
    pub account_id: String,
    pub bank: String,
    pub variant: Option<String>,
    pub account_type: String,
    pub opening_date: Option<String>,
    pub closing_date: Option<String>,
    pub formats: Vec<String>,
    pub statements: Vec<StatementMetadata>,
    pub statement_dates: Vec<String>,
    pub starting: Option<String>,
    pub ending: Option<String>,
    pub statement_count: u32,
    pub period_covered: PeriodCovered,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_fetch_date: Option<String>,
}
