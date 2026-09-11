use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum StatementKind {
    Monthly,
    Annual,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Statement {
    pub account_id: String,
    pub kind: StatementKind,
    pub period: String,
    pub statement_date: String,
    pub formats: Vec<String>,
    pub period_start: Option<String>,
    pub period_end: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CoverageSegment {
    pub start: String,
    pub end: String,
    pub approximate: Option<bool>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CoverageGap {
    pub start: String,
    pub end: String,
    pub balances_match: Option<bool>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct StatementCoverage {
    pub start: Option<String>,
    pub end: Option<String>,
    pub segments: Vec<CoverageSegment>,
    pub gaps: Vec<CoverageGap>,
    pub months: Vec<String>,
    pub period_count: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct BalanceGap {
    pub month: String,
    pub status: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct StatementList {
    pub available: bool,
    pub statement_count: u32,
    pub starting: Option<String>,
    pub ending: Option<String>,
    pub formats: Vec<String>,
    pub coverage: StatementCoverage,
    pub statements: Vec<Statement>,
    pub balance_gaps: Vec<BalanceGap>,
}
