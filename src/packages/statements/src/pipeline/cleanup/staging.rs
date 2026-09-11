use std::path::Path;

use crate::banks::handlers::get_handler;
use crate::domain::Account;
use crate::pdf::extract_pdf_text;
use crate::pipeline::alerts::{emit_pdf_open_alert, AlertService};
use crate::pipeline::cleanup::exclusion::statement_should_exclude;
use crate::pipeline::cleanup::models::MonthGroups;
use crate::vault::path::{is_csv_path, is_pdf_path, iter_pdfs};

const METADATA_FILENAME: &str = "metadata.json";

fn is_staging_file(staging_dir: &Path, path: &Path, is_type: fn(&Path) -> bool) -> bool {
    path.parent() == Some(staging_dir) && path.is_file() && is_type(path)
}

pub fn is_staging_pdf(staging_dir: &Path, path: &Path) -> bool {
    is_staging_file(staging_dir, path, is_pdf_path)
}

pub fn is_staging_csv(staging_dir: &Path, path: &Path) -> bool {
    is_staging_file(staging_dir, path, is_csv_path)
}

pub fn prune_unsupported_staging_files(staging_dir: &Path) -> u32 {
    if !staging_dir.is_dir() {
        return 0;
    }
    let mut removed = 0u32;
    let entries = std::fs::read_dir(staging_dir).ok();
    for entry in entries.into_iter().flatten().flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let ext = path
            .extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_default();
        if ext == "pdf"
            || ext == "csv"
            || path
                .file_name()
                .map(|n| n == METADATA_FILENAME)
                .unwrap_or(false)
        {
            continue;
        }
        if std::fs::remove_file(&path).is_ok() {
            removed += 1;
        }
    }
    removed
}

pub fn decrypt_pdfs_in_place(
    staging_dir: &Path,
    account: &Account,
    alerts: &mut AlertService,
) -> u32 {
    let mut decrypted = 0u32;
    for path in iter_pdfs(staging_dir) {
        match extract_pdf_text(&path, &account.passwords) {
            Ok(_) => decrypted += 1,
            Err(err) => emit_pdf_open_alert(alerts, account, &path, &err),
        }
    }
    decrypted
}

pub fn prune_excluded_staging(
    staging_dir: &Path,
    account: &Account,
    collected: &MonthGroups,
    csv_collected: Option<&MonthGroups>,
) -> u32 {
    let handler = get_handler(&account.bank, account.variant.as_deref()).ok();
    if handler.is_none() {
        return 0;
    }
    let handler = handler.unwrap();
    let mut removed = 0u32;

    for (path, raw) in &collected.raw_by_path {
        if !path.is_file() || !is_staging_pdf(staging_dir, path) {
            continue;
        }
        if crate::pipeline::upload::period_from_manual_upload(
            &path.file_name().unwrap_or_default().to_string_lossy(),
        )
        .is_some()
        {
            continue;
        }
        let sanitized = handler.clean_text(raw);
        if !statement_should_exclude(raw, &sanitized, account, false) {
            continue;
        }
        if std::fs::remove_file(path).is_ok() {
            removed += 1;
        }
    }

    if let Some(csv_collected) = csv_collected {
        for (path, raw) in &csv_collected.raw_by_path {
            if !path.is_file() || !is_staging_csv(staging_dir, path) {
                continue;
            }
            if crate::pipeline::upload::period_from_manual_upload(
                &path.file_name().unwrap_or_default().to_string_lossy(),
            )
            .is_some()
            {
                continue;
            }
            if !statement_should_exclude(raw, raw, account, false) {
                continue;
            }
            if std::fs::remove_file(path).is_ok() {
                removed += 1;
            }
        }
    }

    removed
}
