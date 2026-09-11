use std::collections::HashMap;
use std::path::PathBuf;

use crate::banks::helpers::text_contains_present;
use crate::banks::period::{period_source_for_path, period_source_rank};
use crate::domain::Account;
use crate::errors::StageError;
use crate::pipeline::alerts::AlertService;
use crate::pipeline::cleanup::canonical::{sanitized_text, write_statement_pair};
use crate::pipeline::cleanup::exclusion::statement_should_exclude;
use crate::pipeline::cleanup::grouping::{dedupe_paths_by_hash, file_hash};
use crate::pipeline::cleanup::keeper::{delete_pdf_duplicates, select_keeper};
use crate::pipeline::cleanup::models::PreparedStatement;
use crate::pipeline::cleanup::prepare_common::{
    eligible_paths, filter_existing, report_ambiguous_period, unlink_excluded, MonthPrepareInput,
};
use crate::pipeline::upload::period_from_manual_upload;
use crate::vault::path::{statement_relative_path, statement_txt_relative};
use crate::vault::store::{exists, read_bytes, unlink, FileStoreConfig};

pub fn prepare_month(
    input: &MonthPrepareInput<'_>,
    alerts: &mut AlertService,
) -> Result<(u32, u32, Option<PreparedStatement>), StageError> {
    let MonthPrepareInput {
        staging_dir,
        config,
        month,
        candidates,
        account,
        raw_by_path,
        path_month,
        path_hash,
        path_period_source,
    } = input;
    let path_hash = *path_hash;
    let path_period_source = *path_period_source;
    let existing = filter_existing(candidates);
    if existing.is_empty() {
        return Ok((0, 0, None));
    }

    let unique = dedupe_paths_by_hash(&existing, path_hash)?;
    let mut sanitized_by_path = HashMap::new();
    for path in &unique {
        let raw = raw_by_path
            .and_then(|lookup| lookup.get(path))
            .map(|s| s.as_str())
            .unwrap_or("");
        sanitized_by_path.insert(path.clone(), sanitized_text(raw, account)?);
    }

    let period_source_lookup = path_period_source.cloned().unwrap_or_default();
    let hash_lookup = path_hash.cloned().unwrap_or_default();
    let label = format!("{}/{}", account.bank, account.id);
    let pdf_relative = statement_relative_path(&account.account_type, &account.id, month, "pdf");
    let canonical_exists = exists(config, &pdf_relative);
    let text_contains = account
        .statement
        .as_ref()
        .map(|s| s.text_contains.clone())
        .unwrap_or_default();

    let manual_candidates: Vec<PathBuf> = unique
        .iter()
        .filter(|path| {
            period_from_manual_upload(&path.file_name().unwrap_or_default().to_string_lossy())
                .is_some()
        })
        .cloned()
        .collect();
    let manual_paths: std::collections::HashSet<PathBuf> =
        manual_candidates.iter().cloned().collect();

    unlink_excluded(&unique, &|path| {
        !manual_paths.contains(path)
            && statement_should_exclude(
                raw_by_path
                    .and_then(|lookup| lookup.get(path))
                    .map(|s| s.as_str())
                    .unwrap_or(""),
                sanitized_by_path
                    .get(path)
                    .map(|s| s.as_str())
                    .unwrap_or(""),
                account,
                false,
            )
    });

    let eligible = eligible_paths(&unique, &|path| {
        manual_paths.contains(path)
            || !statement_should_exclude(
                raw_by_path
                    .and_then(|lookup| lookup.get(path))
                    .map(|s| s.as_str())
                    .unwrap_or(""),
                sanitized_by_path
                    .get(path)
                    .map(|s| s.as_str())
                    .unwrap_or(""),
                account,
                false,
            )
    });
    if eligible.is_empty() {
        return Ok((0, 1, None));
    }

    let (keeper, ambiguous_paths) = select_keeper(
        &eligible,
        account,
        &sanitized_by_path,
        &period_source_lookup,
        &hash_lookup,
        &text_contains,
        &manual_candidates,
    )?;

    if !ambiguous_paths.is_empty() {
        report_ambiguous_period(
            "PDF",
            &label,
            month,
            &ambiguous_paths,
            &period_source_lookup,
            &text_contains,
            alerts,
        );
        return Ok((0, 1, None));
    }

    if keeper.is_none() {
        for path in &eligible {
            if canonical_exists {
                continue;
            }
            if !text_contains.is_empty() {
                check_text_contains(
                    sanitized_by_path
                        .get(path)
                        .map(|s| s.as_str())
                        .unwrap_or(""),
                    &text_contains,
                    &path.file_name().unwrap_or_default().to_string_lossy(),
                    &label,
                    alerts,
                );
            }
        }
        return Ok((0, 1, None));
    }

    let keeper = keeper.unwrap();
    let raw = raw_by_path
        .and_then(|lookup| lookup.get(&keeper))
        .cloned()
        .unwrap_or_default();
    let keeper_is_manual = manual_paths.contains(&keeper);
    let keeper_rank = period_source_rank(period_source_for_path(&keeper, &period_source_lookup));
    let keeper_digest = hash_lookup
        .get(&keeper)
        .cloned()
        .unwrap_or_else(|| file_hash(&keeper).unwrap_or_default());

    for path in &eligible {
        if path == &keeper {
            continue;
        }
        if keeper_is_manual
            || !text_contains_present(
                sanitized_by_path
                    .get(path)
                    .map(|s| s.as_str())
                    .unwrap_or(""),
                &text_contains,
            )
        {
            if !text_contains.is_empty() && !keeper_is_manual {
                check_text_contains(
                    sanitized_by_path
                        .get(path)
                        .map(|s| s.as_str())
                        .unwrap_or(""),
                    &text_contains,
                    &path.file_name().unwrap_or_default().to_string_lossy(),
                    &label,
                    alerts,
                );
            }
            continue;
        }
        let path_rank = period_source_rank(period_source_for_path(path, &period_source_lookup));
        let path_digest = hash_lookup
            .get(path)
            .cloned()
            .unwrap_or_else(|| file_hash(path).unwrap_or_default());
        if (path_digest == keeper_digest || path_rank > keeper_rank) && path.is_file() {
            let _ = std::fs::remove_file(path);
        }
    }

    let dedupe_lookup = path_month.cloned().unwrap_or_else(|| {
        unique
            .iter()
            .map(|path| (path.clone(), month.to_string()))
            .collect()
    });
    delete_pdf_duplicates(
        staging_dir,
        month,
        &dedupe_lookup,
        Some(&keeper),
        path_hash,
        path_period_source,
    )?;
    let prepared = write_statement_pair(config, staging_dir, account, month, &keeper, &raw)?;
    Ok((1, 0, Some(prepared)))
}

fn check_text_contains(
    text: &str,
    text_contains: &[String],
    source_file: &str,
    account_label: &str,
    alerts: &mut AlertService,
) -> bool {
    if text_contains_present(text, text_contains) {
        return true;
    }
    alerts.emit(crate::pipeline::alerts::Alert {
        kind: crate::pipeline::alerts::AlertKind::TextContainsMissing,
        message: format!(
            "text_contains {:?} not found in {}",
            text_contains, source_file
        ),
        account: account_label.to_string(),
        source_file: source_file.to_string(),
        text_contains: text_contains.to_vec(),
    });
    false
}

pub fn should_skip_current_pair(
    config: &FileStoreConfig,
    account: &Account,
    month: &str,
    candidates: &[PathBuf],
) -> Result<bool, StageError> {
    let pdf_relative = statement_relative_path(&account.account_type, &account.id, month, "pdf");
    let txt_relative = statement_txt_relative(&account.account_type, &account.id, month);
    let extra = candidates.iter().filter(|path| path.is_file()).count();
    if extra > 0 {
        return Ok(false);
    }
    if !exists(config, &pdf_relative) || !exists(config, &txt_relative) {
        return Ok(false);
    }
    let txt_bytes = read_bytes(config, &txt_relative)
        .map_err(|e| StageError::new(e.to_string()))?
        .unwrap_or_default();
    let txt_content = String::from_utf8_lossy(&txt_bytes);
    if statement_should_exclude(&txt_content, &txt_content, account, false) {
        unlink(config, &pdf_relative).map_err(|e| StageError::new(e.to_string()))?;
        unlink(config, &txt_relative).map_err(|e| StageError::new(e.to_string()))?;
        return Ok(true);
    }
    let text_contains = account
        .statement
        .as_ref()
        .map(|s| s.text_contains.clone())
        .unwrap_or_default();
    let text_not_contains = account
        .statement
        .as_ref()
        .map(|s| s.text_not_contains.clone())
        .unwrap_or_default();
    if crate::banks::helpers::statement_text_eligible(
        &txt_content,
        &text_contains,
        &text_not_contains,
        false,
    ) {
        return Ok(true);
    }
    unlink(config, &pdf_relative).map_err(|e| StageError::new(e.to_string()))?;
    unlink(config, &txt_relative).map_err(|e| StageError::new(e.to_string()))?;
    Ok(true)
}
