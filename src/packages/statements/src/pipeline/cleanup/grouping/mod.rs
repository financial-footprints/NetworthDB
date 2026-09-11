use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

use sha2::{Digest, Sha256};

use crate::banks::period::{resolve_key_with_source, resolve_period_key_with_source};
use crate::domain::Account;
use crate::errors::StageError;
use crate::pdf::extract_pdf_text;
use crate::pipeline::alerts::{emit_pdf_open_alert, AlertService};
use crate::pipeline::cleanup::models::MonthGroups;
use crate::pipeline::upload::period_from_manual_upload;
use crate::vault::path::{is_csv_path, is_pdf_path};

type ResolvePeriodFn =
    fn(
        &str,
        &str,
        &Account,
    ) -> Result<(String, crate::banks::period_source::PeriodSource), StageError>;

pub fn file_hash(path: &Path) -> Result<String, StageError> {
    let bytes = std::fs::read(path).map_err(|e| StageError::new(e.to_string()))?;
    Ok(Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{:02x}", byte))
        .collect())
}

pub fn dedupe_paths_by_hash(
    paths: &[PathBuf],
    path_hash: Option<&HashMap<PathBuf, String>>,
) -> Result<Vec<PathBuf>, StageError> {
    let mut seen: HashMap<String, PathBuf> = HashMap::new();
    for path in paths {
        let digest = if let Some(lookup) = path_hash {
            lookup.get(path).cloned()
        } else {
            None
        };
        let digest = match digest {
            Some(d) => d,
            None => file_hash(path)?,
        };
        seen.entry(digest).or_insert_with(|| path.clone());
    }
    Ok(seen.values().cloned().collect())
}

fn collect_groups(
    paths: &[PathBuf],
    account: &Account,
    read_raw: fn(&Path, &Account) -> Result<String, StageError>,
    resolve_period: ResolvePeriodFn,
    soft_read_fail: bool,
    mut alerts: Option<&mut AlertService>,
) -> Result<MonthGroups, StageError> {
    let mut by_month: HashMap<String, Vec<PathBuf>> = HashMap::new();
    let mut raw_by_path: HashMap<PathBuf, String> = HashMap::new();
    let mut path_month: HashMap<PathBuf, String> = HashMap::new();
    let mut path_hash: HashMap<PathBuf, String> = HashMap::new();
    let mut path_period_source: HashMap<PathBuf, crate::banks::period_source::PeriodSource> =
        HashMap::new();
    let mut seen: HashSet<String> = HashSet::new();
    let mut hash_to_raw: HashMap<String, String> = HashMap::new();

    let mut sorted = paths.to_vec();
    sorted.sort();

    for path in sorted {
        let key = path
            .canonicalize()
            .unwrap_or(path.clone())
            .to_string_lossy()
            .to_string();
        if seen.contains(&key) {
            continue;
        }
        seen.insert(key);
        let digest = file_hash(&path)?;
        path_hash.insert(path.clone(), digest.clone());
        let raw = if let Some(existing) = hash_to_raw.get(&digest) {
            existing.clone()
        } else {
            let loaded = if soft_read_fail {
                match extract_pdf_text(&path, &account.passwords) {
                    Ok(text) => text,
                    Err(err) => {
                        if let Some(alerts) = &mut alerts {
                            emit_pdf_open_alert(alerts, account, &path, &err);
                        }
                        continue;
                    }
                }
            } else {
                read_raw(&path, account)?
            };
            hash_to_raw.insert(digest.clone(), loaded.clone());
            loaded
        };
        raw_by_path.insert(path.clone(), raw.clone());

        let (month, source) = if let Some(manual_month) =
            period_from_manual_upload(&path.file_name().unwrap_or_default().to_string_lossy())
        {
            (
                manual_month,
                crate::banks::period_source::PeriodSource::Manual,
            )
        } else {
            let filename = path.file_name().unwrap_or_default().to_string_lossy();
            resolve_period(&raw, &filename, account)?
        };
        path_month.insert(path.clone(), month.clone());
        path_period_source.insert(path.clone(), source);
        by_month.entry(month).or_default().push(path);
    }

    Ok(MonthGroups {
        groups: by_month,
        raw_by_path,
        path_month,
        path_hash,
        path_period_source,
    })
}

fn read_pdf_raw(path: &Path, account: &Account) -> Result<String, StageError> {
    extract_pdf_text(path, &account.passwords).map_err(|e| StageError::new(e.message.clone()))
}

fn read_csv_raw(path: &Path, _account: &Account) -> Result<String, StageError> {
    std::fs::read_to_string(path).map_err(|e| StageError::new(e.to_string()))
}

fn resolve_pdf_period(
    raw: &str,
    filename: &str,
    account: &Account,
) -> Result<(String, crate::banks::period_source::PeriodSource), StageError> {
    resolve_period_key_with_source(raw, filename, account)
}

fn resolve_csv_period(
    raw: &str,
    filename: &str,
    account: &Account,
) -> Result<(String, crate::banks::period_source::PeriodSource), StageError> {
    resolve_key_with_source(raw, filename, account)
}

fn list_staging_pdf_and_csv_paths(
    staging_dir: &Path,
    pdf_paths: Option<&[PathBuf]>,
    csv_paths: Option<&[PathBuf]>,
) -> (Vec<PathBuf>, Vec<PathBuf>) {
    if let (Some(pdfs), Some(csvs)) = (pdf_paths, csv_paths) {
        return (pdfs.to_vec(), csvs.to_vec());
    }
    let mut listed_pdfs = Vec::new();
    let mut listed_csvs = Vec::new();
    if staging_dir.is_dir() {
        let entries = std::fs::read_dir(staging_dir).ok();
        for entry in entries.into_iter().flatten().flatten() {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            if is_pdf_path(&path) {
                listed_pdfs.push(path);
            } else if is_csv_path(&path) {
                listed_csvs.push(path);
            }
        }
    }
    (
        pdf_paths.map(|p| p.to_vec()).unwrap_or(listed_pdfs),
        csv_paths.map(|p| p.to_vec()).unwrap_or(listed_csvs),
    )
}

pub fn collect_staging_groups(
    staging_dir: &Path,
    account: &Account,
    pdf_paths: Option<&[PathBuf]>,
    csv_paths: Option<&[PathBuf]>,
    alerts: &mut AlertService,
) -> Result<(MonthGroups, MonthGroups), StageError> {
    let (resolved_pdfs, resolved_csvs) =
        list_staging_pdf_and_csv_paths(staging_dir, pdf_paths, csv_paths);
    let pdf_groups = collect_groups(
        &resolved_pdfs,
        account,
        read_pdf_raw,
        resolve_pdf_period,
        true,
        Some(alerts),
    )?;
    let csv_groups = collect_groups(
        &resolved_csvs,
        account,
        read_csv_raw,
        resolve_csv_period,
        false,
        None,
    )?;
    Ok((pdf_groups, csv_groups))
}

#[cfg(test)]
mod test_grouping;
