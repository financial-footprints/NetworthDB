use std::collections::HashMap;
use std::path::{Path, PathBuf};

use crate::banks::period_source::PeriodSource;
use crate::domain::Account;
use crate::pipeline::alerts::{Alert, AlertKind, AlertService};
use crate::pipeline::cleanup::keeper::format_ambiguous_candidates;
use crate::vault::store::FileStoreConfig;

pub struct MonthPrepareInput<'a> {
    pub staging_dir: &'a Path,
    pub config: &'a FileStoreConfig,
    pub month: &'a str,
    pub candidates: &'a [PathBuf],
    pub account: &'a Account,
    pub raw_by_path: Option<&'a HashMap<PathBuf, String>>,
    pub path_month: Option<&'a HashMap<PathBuf, String>>,
    pub path_hash: Option<&'a HashMap<PathBuf, String>>,
    pub path_period_source: Option<&'a HashMap<PathBuf, PeriodSource>>,
}

pub fn filter_existing(candidates: &[PathBuf]) -> Vec<PathBuf> {
    candidates
        .iter()
        .filter(|path| path.is_file())
        .cloned()
        .collect()
}

pub fn unlink_excluded(unique: &[PathBuf], should_exclude: &dyn Fn(&PathBuf) -> bool) {
    for path in unique {
        if !should_exclude(path) || !path.is_file() {
            continue;
        }
        let _ = std::fs::remove_file(path);
    }
}

pub fn eligible_paths(unique: &[PathBuf], is_eligible: &dyn Fn(&PathBuf) -> bool) -> Vec<PathBuf> {
    unique
        .iter()
        .filter(|path| path.is_file() && is_eligible(path))
        .cloned()
        .collect()
}

pub fn report_ambiguous_period(
    format_label: &str,
    label: &str,
    month: &str,
    ambiguous_paths: &[PathBuf],
    period_source_lookup: &std::collections::HashMap<PathBuf, PeriodSource>,
    text_contains: &[String],
    alerts: &mut AlertService,
) {
    let conflict_summary = format_ambiguous_candidates(ambiguous_paths, period_source_lookup);
    alerts.emit(Alert {
        kind: AlertKind::AmbiguousStatementPeriod,
        message: format!(
            "multiple matching {}s with same period confidence for {}: {}; manual review required",
            format_label, month, conflict_summary
        ),
        account: label.to_string(),
        source_file: month.to_string(),
        text_contains: text_contains.to_vec(),
    });
}
