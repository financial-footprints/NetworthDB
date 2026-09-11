use std::collections::HashMap;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PeriodSource {
    Manual,
    Annual,
    ContentDate,
    FilenameFallback,
    Unknown,
}

pub fn period_source_rank(source: PeriodSource) -> i32 {
    match source {
        PeriodSource::Manual => -1,
        PeriodSource::Annual => 0,
        PeriodSource::ContentDate => 1,
        PeriodSource::FilenameFallback => 2,
        PeriodSource::Unknown => 3,
    }
}

pub fn period_source_for_path(
    path: &Path,
    lookup: &HashMap<PathBuf, PeriodSource>,
) -> PeriodSource {
    if let Some(source) = lookup.get(path) {
        return *source;
    }
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    if name.starts_with("manual__") {
        return PeriodSource::Manual;
    }
    PeriodSource::Unknown
}
