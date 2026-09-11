use std::path::Path;

use crate::domain::{Account, StatementWarning};
use crate::errors::StageError;
use crate::pipeline::alerts::AlertService;
use crate::pipeline::cleanup::canonical::prune_ineligible;
use crate::pipeline::cleanup::grouping::collect_staging_groups;
use crate::pipeline::cleanup::orphans::sweep_orphans;
use crate::pipeline::cleanup::prepare_common::MonthPrepareInput;
use crate::pipeline::cleanup::prepare_csv_month::prepare_csv_month;
use crate::pipeline::cleanup::prepare_month::{prepare_month, should_skip_current_pair};
use crate::pipeline::cleanup::staging::{
    decrypt_pdfs_in_place, prune_excluded_staging, prune_unsupported_staging_files,
};
use crate::pipeline::context::{raise_if_cancelled, RunContext};
use crate::pipeline::results::CleanupAccountResult;
use crate::pipeline::upload::manual_upload_pdf_path;
use crate::vault::path::statement_relative_path;
use crate::vault::store::{exists, FileStoreConfig};
use crate::vault::workspace;

pub fn run(
    config: &FileStoreConfig,
    staging_dir: &Path,
    account: &Account,
    upload_statement_date: Option<&str>,
    financial_year: Option<&str>,
    run_ctx: &RunContext,
) -> Result<CleanupAccountResult, StageError> {
    raise_if_cancelled(run_ctx)?;
    workspace::ensure_dir(staging_dir)?;
    if !staging_dir.is_dir() {
        return Ok(CleanupAccountResult {
            bank: account.bank.clone(),
            download_dir: staging_dir.to_path_buf(),
            unsupported_staging_removed: 0,
            decrypted: 0,
            prepared: 0,
            rejected: 0,
            orphans_removed: 0,
            skipped: true,
            warnings: Vec::new(),
            prepared_statements: Vec::new(),
        });
    }

    let mut alerts = AlertService::new();
    let removed = prune_unsupported_staging_files(staging_dir);
    let decrypted = decrypt_pdfs_in_place(staging_dir, account, &mut alerts);

    let (pdf_paths, csv_paths) = if let Some(statement_date) = upload_statement_date {
        let upload_path = manual_upload_pdf_path(staging_dir, statement_date);
        let pdf_paths = if upload_path.is_file() {
            vec![upload_path]
        } else {
            vec![]
        };
        (Some(pdf_paths), Some(vec![]))
    } else {
        (None, None)
    };

    let (collected, csv_collected) = collect_staging_groups(
        staging_dir,
        account,
        pdf_paths.as_deref(),
        csv_paths.as_deref(),
        &mut alerts,
    )?;
    prune_excluded_staging(staging_dir, account, &collected, Some(&csv_collected));
    prune_ineligible(config, account, financial_year)?;

    let mut prepared_count = 0u32;
    let mut rejected = 0u32;
    let mut prepared_statements = Vec::new();

    let mut months: Vec<String> = collected.groups.keys().cloned().collect();
    months.sort();
    for month in months {
        raise_if_cancelled(run_ctx)?;
        if month == "unknown-month" {
            continue;
        }
        let candidates = collected.groups.get(&month).cloned().unwrap_or_default();
        if should_skip_current_pair(config, account, &month, &candidates)? {
            continue;
        }
        let (month_prepared, month_rejected, prepared) = prepare_month(
            &MonthPrepareInput {
                staging_dir,
                config,
                month: &month,
                candidates: &candidates,
                account,
                raw_by_path: Some(&collected.raw_by_path),
                path_month: Some(&collected.path_month),
                path_hash: Some(&collected.path_hash),
                path_period_source: Some(&collected.path_period_source),
            },
            &mut alerts,
        )?;
        prepared_count += month_prepared;
        rejected += month_rejected;
        if let Some(stmt) = prepared {
            prepared_statements.push(stmt);
        }
    }

    if upload_statement_date.is_none() {
        let mut csv_months: Vec<String> = csv_collected.groups.keys().cloned().collect();
        csv_months.sort();
        for month in csv_months {
            raise_if_cancelled(run_ctx)?;
            if month == "unknown-month" {
                continue;
            }
            let candidates = csv_collected
                .groups
                .get(&month)
                .cloned()
                .unwrap_or_default();
            let csv_relative =
                statement_relative_path(&account.account_type, &account.id, &month, "csv");
            let extra = candidates.iter().filter(|path| path.is_file()).count();
            if extra == 0 && exists(config, &csv_relative) {
                continue;
            }
            let (month_prepared, month_rejected, prepared) = prepare_csv_month(
                &MonthPrepareInput {
                    staging_dir,
                    config,
                    month: &month,
                    candidates: &candidates,
                    account,
                    raw_by_path: Some(&csv_collected.raw_by_path),
                    path_month: Some(&csv_collected.path_month),
                    path_hash: Some(&csv_collected.path_hash),
                    path_period_source: Some(&csv_collected.path_period_source),
                },
                &mut alerts,
            )?;
            prepared_count += month_prepared;
            rejected += month_rejected;
            if let Some(stmt) = prepared {
                prepared_statements.push(stmt);
            }
        }
    }

    let orphans = sweep_orphans(config, account, financial_year)?;
    let warnings: Vec<StatementWarning> = alerts
        .alerts()
        .iter()
        .map(|alert| alert.to_statement_warning())
        .collect();

    if run_ctx.trace_enabled() {
        run_ctx.trace_info(
            "cleanup",
            "cleanup stage completed",
            Some(serde_json::json!({
                "accountId": account.id,
                "bank": account.bank,
                "unsupportedStagingRemoved": removed,
                "decrypted": decrypted,
                "prepared": prepared_count,
                "rejected": rejected,
                "orphansRemoved": orphans,
                "preparedPeriods": prepared_statements
                    .iter()
                    .map(|stmt| stmt.period.clone())
                    .collect::<Vec<_>>(),
                "warningCount": warnings.len(),
            })),
        );
    }

    Ok(CleanupAccountResult {
        bank: account.bank.clone(),
        download_dir: staging_dir.to_path_buf(),
        unsupported_staging_removed: removed,
        decrypted,
        prepared: prepared_count,
        rejected,
        orphans_removed: orphans,
        skipped: false,
        warnings,
        prepared_statements,
    })
}

pub fn run_account(
    config: &FileStoreConfig,
    staging_dir: &Path,
    account: &Account,
    upload_statement_date: Option<&str>,
    financial_year: Option<&str>,
    run_ctx: &RunContext,
) -> Result<CleanupAccountResult, StageError> {
    run(
        config,
        staging_dir,
        account,
        upload_statement_date,
        financial_year,
        run_ctx,
    )
}
