use std::fs;
use std::path::{Path, PathBuf};

use crate::period::{
    fiscal_year_key_from_month_key, is_calendar_year_period, is_fy_period, parse_month_period,
    statement_basename,
};

pub const NWENC_SUFFIX: &str = ".nwenc";
const TRANSACTIONS_PREFIX: &str = "transactions-";
const STATEMENT_CSV_SUFFIX: &str = ".csv";

pub fn fy_folder_name(statement_period: &str) -> String {
    if statement_period == "unknown-month" {
        return "unknown-month".to_string();
    }
    if is_fy_period(statement_period) || is_calendar_year_period(statement_period) {
        return statement_period.to_string();
    }
    fiscal_year_key_from_month_key(statement_period)
}

pub fn statement_relative_path(
    account_type: &str,
    account_id: &str,
    statement_period: &str,
    extension: &str,
) -> String {
    let ext = extension.strip_prefix('.').unwrap_or(extension);
    let basename = statement_basename(statement_period);
    let fy = fy_folder_name(statement_period);
    format!(
        "{}/{}/{}/{}.{}",
        fy, account_type, account_id, basename, ext
    )
}

pub fn account_metadata_relative(account_type: &str, account_id: &str) -> String {
    format!("{}/{}/metadata.json", account_type, account_id)
}

pub fn manual_upload_staging_relative(
    account_type: &str,
    account_id: &str,
    statement_date: &str,
) -> String {
    format!(
        "{}/{}/manual__{}.pdf",
        account_type, account_id, statement_date
    )
}

pub fn statement_txt_relative(
    account_type: &str,
    account_id: &str,
    statement_period: &str,
) -> String {
    statement_relative_path(account_type, account_id, statement_period, "txt")
}

pub fn transactions_csv_relative(
    account_type: &str,
    account_id: &str,
    period_stem: &str,
) -> String {
    let fy = fy_folder_name(period_stem);
    format!(
        "{}/{}/{}/{}",
        fy,
        account_type,
        account_id,
        transactions_csv_name(period_stem)
    )
}

pub fn to_posix_relative(relative: &str) -> String {
    relative.replace('\\', "/")
}

pub fn transactions_csv_name(period_stem: &str) -> String {
    format!(
        "{}{}{}",
        TRANSACTIONS_PREFIX, period_stem, STATEMENT_CSV_SUFFIX
    )
}

pub fn is_pdf_path(path: &Path) -> bool {
    path.extension()
        .map(|ext| ext.eq_ignore_ascii_case("pdf"))
        .unwrap_or(false)
}

pub fn is_csv_path(path: &Path) -> bool {
    path.extension()
        .map(|ext| ext.eq_ignore_ascii_case("csv"))
        .unwrap_or(false)
}

pub fn is_transactions_csv(path: &Path) -> bool {
    let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
    name.starts_with(TRANSACTIONS_PREFIX)
        && name.to_ascii_lowercase().ends_with(STATEMENT_CSV_SUFFIX)
}

pub fn iter_pdfs(directory: &Path) -> Vec<PathBuf> {
    if !directory.is_dir() {
        return vec![];
    }
    let mut paths: Vec<PathBuf> = fs::read_dir(directory)
        .ok()
        .into_iter()
        .flatten()
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let path = entry.path();
            if path.is_file() && is_pdf_path(&path) {
                Some(path)
            } else {
                None
            }
        })
        .collect();
    paths.sort_by(|a, b| a.as_os_str().cmp(b.as_os_str()));
    paths
}

pub fn iter_csvs(directory: &Path) -> Vec<PathBuf> {
    if !directory.is_dir() {
        return vec![];
    }
    let mut paths: Vec<PathBuf> = fs::read_dir(directory)
        .ok()
        .into_iter()
        .flatten()
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let path = entry.path();
            if path.is_file() && is_csv_path(&path) {
                Some(path)
            } else {
                None
            }
        })
        .collect();
    paths.sort_by(|a, b| a.as_os_str().cmp(b.as_os_str()));
    paths
}

pub fn unique_path(directory: &Path, filename: &str) -> PathBuf {
    let target = directory.join(filename);
    if !target.exists() {
        return target;
    }
    let path = Path::new(filename);
    let stem = path.file_stem().unwrap_or_default().to_string_lossy();
    let suffix = path
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy()))
        .unwrap_or_default();
    let mut n = 1u32;
    loop {
        let candidate = directory.join(format!("{} ({}){}", stem, n, suffix));
        if !candidate.exists() {
            return candidate;
        }
        n += 1;
    }
}

fn account_path_segment(account_type: &str, account_id: &str) -> String {
    format!("/{}/{}/", account_type, account_id)
}

fn matches_financial_year(key: &str, financial_year: Option<&str>) -> bool {
    match financial_year {
        None => true,
        Some(fy) => key.starts_with(&format!("{}/", fy)),
    }
}

/// List transaction CSV relative keys for an account via the vault store.
pub fn list_transactions_csv_relatives(
    config: &crate::vault::store::FileStoreConfig,
    account_type: &str,
    account_id: &str,
    financial_year: Option<&str>,
) -> Result<Vec<String>, crate::vault::store::StoreError> {
    let segment = account_path_segment(account_type, account_id);
    let prefix = financial_year.map(|fy| format!("{}/{}/{}/", fy, account_type, account_id));
    let keys = crate::vault::store::list(config, prefix.as_deref())?;
    Ok(keys
        .into_iter()
        .filter(|key| {
            key.contains(&segment)
                && key
                    .rsplit('/')
                    .next()
                    .map(|name| is_transactions_csv(Path::new(name)))
                    .unwrap_or(false)
                && matches_financial_year(key, financial_year)
        })
        .collect())
}

/// List monthly statement PDF relative keys for an account via the vault store.
pub fn list_monthly_pdf_relatives(
    config: &crate::vault::store::FileStoreConfig,
    account_type: &str,
    account_id: &str,
    financial_year: Option<&str>,
) -> Result<Vec<String>, crate::vault::store::StoreError> {
    let segment = account_path_segment(account_type, account_id);
    let prefix = financial_year.map(|fy| format!("{}/{}/{}/", fy, account_type, account_id));
    let keys = crate::vault::store::list(config, prefix.as_deref())?;
    Ok(keys
        .into_iter()
        .filter(|key| {
            key.contains(&segment)
                && key.ends_with(".pdf")
                && !key.contains("/manual__")
                && key
                    .rsplit('/')
                    .next()
                    .and_then(|stem| stem.strip_suffix(".pdf"))
                    .and_then(parse_month_period)
                    .is_some()
                && matches_financial_year(key, financial_year)
        })
        .collect())
}

#[cfg(test)]
mod test_path;
