use std::collections::HashMap;
use std::path::PathBuf;

use crate::banks::period_source::PeriodSource;

#[derive(Debug, Clone)]
pub struct PreparedStatement {
    pub period: String,
    pub cleaned_text: String,
    pub pdf_bytes: Option<Vec<u8>>,
    pub source_csv: Option<Vec<u8>>,
}

#[derive(Debug, Clone)]
pub struct MonthGroups {
    pub groups: HashMap<String, Vec<PathBuf>>,
    pub raw_by_path: HashMap<PathBuf, String>,
    pub path_month: HashMap<PathBuf, String>,
    pub path_hash: HashMap<PathBuf, String>,
    pub path_period_source: HashMap<PathBuf, PeriodSource>,
}
