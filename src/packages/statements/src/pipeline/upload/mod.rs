//! Post-upload ingest.

use std::path::{Path, PathBuf};
use std::sync::LazyLock;

use regex::Regex;

use crate::banks::period::resolve_key_with_source;
use crate::domain::Account;
use crate::errors::StageError;
use crate::vault::path::{statement_relative_path, unique_path};
use crate::vault::store::{exists, write_bytes, FileStoreConfig};
use crate::vault::workspace;
use crate::zip::{extract_csvs_from_zip, sanitize_zip_member_name};

const MANUAL_UPLOAD_PREFIX: &str = "manual__";

static MANUAL_UPLOAD_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^manual__(\d{4}-\d{2})\.(?:pdf|csv)$").expect("manual upload pattern")
});
static MANUAL_ANNUAL_UPLOAD_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^manual__((?:FY\d{2}-\d{4})|(?:\d{4}))\.(?:pdf|csv)$")
        .expect("manual annual upload pattern")
});

pub fn period_from_manual_upload(filename: &str) -> Option<String> {
    let name = Path::new(filename)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    if let Some(caps) = MANUAL_ANNUAL_UPLOAD_PATTERN.captures(&name) {
        return Some(
            caps.get(1)
                .map(|m| m.as_str())
                .unwrap_or_default()
                .to_string(),
        );
    }
    if let Some(caps) = MANUAL_UPLOAD_PATTERN.captures(&name) {
        return Some(
            caps.get(1)
                .map(|m| m.as_str())
                .unwrap_or_default()
                .to_string(),
        );
    }
    None
}

pub fn is_valid_statement_period(period: &str) -> bool {
    crate::period::parse_month_period(period).is_some()
        || crate::period::is_fy_period(period)
        || crate::period::is_calendar_year_period(period)
}

pub fn manual_upload_pdf_path(staging_dir: &Path, statement_date: &str) -> PathBuf {
    staging_dir.join(format!("{}{}.pdf", MANUAL_UPLOAD_PREFIX, statement_date))
}

pub fn save_uploaded_csv(
    config: &FileStoreConfig,
    account: &Account,
    statement_date: &str,
    content: &[u8],
) -> Result<String, StageError> {
    let relative =
        statement_relative_path(&account.account_type, &account.id, statement_date, "csv");
    if exists(config, &relative) {
        return Err(StageError::new(format!(
            "statement file already exists: {}",
            statement_date
        )));
    }
    write_bytes(config, &relative, content).map_err(|e| StageError::new(e.to_string()))?;
    Ok(relative)
}

pub fn save_uploaded_zip(
    workspace_dir: &Path,
    account: &Account,
    content: &[u8],
) -> Result<Vec<PathBuf>, StageError> {
    let extracted = extract_csvs_from_zip(content, &account.passwords)
        .map_err(|e| StageError::new(e.to_string()))?;
    workspace::ensure_dir(workspace_dir)?;
    let mut written = Vec::new();
    for item in extracted {
        let csv_text = String::from_utf8_lossy(&item.content);
        let (period, _) = resolve_key_with_source(&csv_text, &item.inner_name, account)?;
        let staging_name = if period != "unknown-month" && is_valid_statement_period(&period) {
            format!("{}{}.csv", MANUAL_UPLOAD_PREFIX, period)
        } else {
            let safe_name = sanitize_zip_member_name(&item.inner_name);
            format!("{}{}", MANUAL_UPLOAD_PREFIX, safe_name)
        };
        let target = unique_path(workspace_dir, &staging_name);
        workspace::write_file(&target, &item.content)?;
        written.push(target);
    }
    Ok(written)
}

pub fn save_manual_upload_pdf(
    workspace_dir: &Path,
    statement_date: &str,
    content: &[u8],
) -> Result<PathBuf, StageError> {
    workspace::ensure_dir(workspace_dir)?;
    let target = manual_upload_pdf_path(workspace_dir, statement_date);
    workspace::write_file(&target, content)?;
    Ok(target)
}

pub fn read_manual_upload_bytes(
    workspace_dir: &Path,
    statement_date: &str,
    format: &str,
) -> Result<Option<Vec<u8>>, StageError> {
    let target = match format {
        "pdf" => manual_upload_pdf_path(workspace_dir, statement_date),
        "csv" => workspace_dir.join(format!("{}{}.csv", MANUAL_UPLOAD_PREFIX, statement_date)),
        _ => return Ok(None),
    };
    workspace::read_file(&target)
}

pub fn canonical_statement_exists(
    config: &FileStoreConfig,
    account: &Account,
    statement_date: &str,
    format: &str,
) -> bool {
    let relative =
        statement_relative_path(&account.account_type, &account.id, statement_date, format);
    exists(config, &relative)
}
