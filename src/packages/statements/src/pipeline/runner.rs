//! Pipeline orchestration (extract → cleanup → metadata → parse).

use crate::domain::{
    Account, AccountTransactions, ProcessResult, StatementWarning, TransactionRow,
};

use crate::errors::StageError;
use crate::pipeline::cleanup;
use crate::pipeline::context::{raise_if_cancelled, RunContext};
use crate::pipeline::delete;
use crate::pipeline::extract;
use crate::pipeline::metadata;
use crate::pipeline::parse;
use crate::run::RunInput;
use crate::vault::path::list_transactions_csv_relatives;
use crate::vault::store::FileStoreConfig;
use serde_json::json;

fn finalize_result(
    ok: bool,
    reason: Option<String>,
    warnings: Vec<StatementWarning>,
) -> ProcessResult {
    ProcessResult {
        ok,
        reason,
        warnings,
        logs: None,
    }
}

pub fn process_pipeline(ctx: &RunInput, run_ctx: &RunContext) -> ProcessResult {
    if run_ctx.trace_enabled() {
        run_ctx.trace_info(
            "pipeline",
            "pipeline started",
            Some(json!({
                "accountCount": ctx.accounts_to_run().len(),
                "sourceCount": ctx.sources.len(),
                "financialYear": ctx.financial_year_filter(),
            })),
        );
    }

    match run_pipeline(ctx, run_ctx) {
        Ok(warnings) => {
            if run_ctx.trace_enabled() {
                run_ctx.trace_info(
                    "pipeline",
                    "pipeline completed",
                    Some(json!({ "warningCount": warnings.len() })),
                );
            }
            finalize_result(true, None, warnings)
        }
        Err(err) => {
            if run_ctx.trace_enabled() {
                run_ctx.trace_error("pipeline", &err.to_string(), None);
            }
            finalize_result(false, Some(err.to_string()), Vec::new())
        }
    }
}

fn run_pipeline(ctx: &RunInput, run_ctx: &RunContext) -> Result<Vec<StatementWarning>, StageError> {
    raise_if_cancelled(run_ctx)?;
    let config = ctx.file_store_config()?;
    let financial_year = ctx.financial_year_filter();
    let mut warnings = Vec::new();
    let extract_result = extract::run_all(ctx, run_ctx)?;

    if run_ctx.trace_enabled() {
        run_ctx.trace_info(
            "extract",
            "extract stage completed",
            Some(json!({
                "accountResults": extract_result
                    .accounts
                    .iter()
                    .map(|result| {
                        json!({
                            "bank": result.bank,
                            "downloadDir": result.download_dir.to_string_lossy(),
                            "messagesMatched": result.messages_matched,
                            "attachmentsSaved": result.attachments_saved,
                        })
                    })
                    .collect::<Vec<_>>(),
            })),
        );
    }

    for account in ctx.accounts_to_run() {
        raise_if_cancelled(run_ctx)?;
        let workspace = ctx.account_workspace(&account);
        if run_ctx.trace_enabled() {
            run_ctx.trace_info(
                "account",
                "processing account",
                Some(json!({
                    "accountId": account.id,
                    "bank": account.bank,
                    "label": account.label,
                })),
            );
        }
        let cleanup_result =
            cleanup::run_account(&config, &workspace, &account, None, financial_year, run_ctx)?;
        warnings.extend(cleanup_result.warnings);
        raise_if_cancelled(run_ctx)?;
        metadata::refresh_account_metadata(
            &config,
            &account,
            financial_year,
            &cleanup_result.prepared_statements,
            run_ctx,
        )?;
        raise_if_cancelled(run_ctx)?;
        let parsed_rows = parse::run_account_parse(
            &config,
            &account,
            financial_year,
            &cleanup_result.prepared_statements,
            run_ctx,
        )?;
        if run_ctx.trace_enabled() {
            run_ctx.trace_info(
                "parse",
                "account parse completed",
                Some(json!({
                    "accountId": account.id,
                    "rowCount": parsed_rows,
                })),
            );
        }
    }
    Ok(warnings)
}

pub fn process_upload(
    ctx: &RunInput,
    run_ctx: &RunContext,
    account_id: &str,
    format: &str,
    statement_date: Option<&str>,
) -> ProcessResult {
    if run_ctx.trace_enabled() {
        run_ctx.trace_info(
            "upload",
            "upload pipeline started",
            Some(json!({
                "accountId": account_id,
                "format": format,
                "statementDate": statement_date,
            })),
        );
    }

    let account = match ctx.accounts.iter().find(|a| a.id == account_id) {
        Some(a) => a.clone(),
        None => {
            return finalize_result(
                false,
                Some(format!("account not found in context: {}", account_id)),
                Vec::new(),
            );
        }
    };

    let config = match ctx.file_store_config() {
        Ok(config) => config,
        Err(err) => {
            return finalize_result(false, Some(err.to_string()), Vec::new());
        }
    };
    let financial_year = ctx.financial_year_filter();
    match format {
        "pdf" => {
            let statement_date = match statement_date {
                Some(d) if !d.is_empty() => d,
                _ => {
                    return finalize_result(
                        false,
                        Some("statement_date required for pdf upload".to_string()),
                        Vec::new(),
                    );
                }
            };
            match run_upload_stages(
                ctx,
                &config,
                &account,
                Some(statement_date),
                financial_year,
                run_ctx,
            ) {
                Ok(warnings) => finalize_result(true, None, warnings),
                Err(err) => finalize_result(false, Some(err.to_string()), Vec::new()),
            }
        }
        "csv" | "zip" => {
            match run_upload_stages(ctx, &config, &account, None, financial_year, run_ctx) {
                Ok(warnings) => finalize_result(true, None, warnings),
                Err(err) => finalize_result(false, Some(err.to_string()), Vec::new()),
            }
        }
        _ => finalize_result(
            false,
            Some("statements.pipeline.upload.invalid-format".to_string()),
            Vec::new(),
        ),
    }
}

pub fn delete_account_statements(ctx: &RunInput, account_id: &str) -> ProcessResult {
    let account = match ctx.accounts.iter().find(|a| a.id == account_id) {
        Some(a) => a.clone(),
        None => {
            return ProcessResult {
                ok: false,
                reason: Some(format!("account not found in context: {}", account_id)),
                warnings: Vec::new(),
                logs: None,
            };
        }
    };
    let config = match ctx.file_store_config() {
        Ok(config) => config,
        Err(err) => {
            return ProcessResult {
                ok: false,
                reason: Some(err.to_string()),
                warnings: Vec::new(),
                logs: None,
            };
        }
    };
    let workspace = ctx.account_workspace(&account);
    match delete::delete_account_statements(&config, &workspace, &account) {
        Ok(_) => ProcessResult {
            ok: true,
            reason: None,
            warnings: Vec::new(),
            logs: None,
        },
        Err(err) => ProcessResult {
            ok: false,
            reason: Some(err.to_string()),
            warnings: Vec::new(),
            logs: None,
        },
    }
}

pub fn list_transaction_csvs(ctx: &RunInput, account: &Account) -> Result<Vec<String>, StageError> {
    let config = ctx.file_store_config()?;
    list_transactions_csv_relatives(
        &config,
        &account.account_type,
        &account.id,
        ctx.financial_year_filter(),
    )
    .map_err(StageError::from)
}

pub fn read_account_transactions(
    ctx: &RunInput,
    account: &Account,
) -> Result<Vec<AccountTransactions>, StageError> {
    let config = ctx.file_store_config()?;
    let relatives = list_transactions_csv_relatives(
        &config,
        &account.account_type,
        &account.id,
        ctx.financial_year_filter(),
    )?;
    let mut results = Vec::new();
    for relative in relatives {
        let bytes = crate::vault::store::read_bytes(&config, &relative)
            .map_err(|e| StageError::new(e.to_string()))?
            .unwrap_or_default();
        let content = String::from_utf8_lossy(&bytes);
        let period = relative
            .rsplit('/')
            .next()
            .and_then(|name| name.strip_prefix("transactions-"))
            .and_then(|stem| stem.strip_suffix(".csv"))
            .unwrap_or("")
            .to_string();
        let is_annual =
            crate::period::is_fy_period(&period) || crate::period::is_calendar_year_period(&period);
        results.push(AccountTransactions {
            period,
            is_annual,
            rows: parse_transaction_csv(&content),
        });
    }
    Ok(results)
}

fn parse_transaction_csv(content: &str) -> Vec<TransactionRow> {
    let lines: Vec<&str> = content.lines().filter(|line| !line.is_empty()).collect();
    if lines.is_empty() {
        return vec![];
    }
    let header = parse_csv_line(lines[0]);
    let mut rows = Vec::new();
    for line in lines.iter().skip(1) {
        let values = parse_csv_line(line);
        let map: std::collections::HashMap<&str, &str> = header
            .iter()
            .zip(values.iter())
            .map(|(k, v)| (k.as_str(), v.as_str()))
            .collect();
        rows.push(TransactionRow {
            date: map.get("Date").unwrap_or(&"").to_string(),
            description: map.get("Description").unwrap_or(&"").to_string(),
            ref_no: map.get("Ref").unwrap_or(&"").to_string(),
            credited: map.get("Credited").unwrap_or(&"0").to_string(),
            debited: map.get("Debited").unwrap_or(&"0").to_string(),
            source_file: map.get("File").unwrap_or(&"").to_string(),
        });
    }
    rows
}

fn parse_csv_line(line: &str) -> Vec<String> {
    let mut values = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    for ch in line.chars() {
        if ch == '"' {
            in_quotes = !in_quotes;
            continue;
        }
        if ch == ',' && !in_quotes {
            values.push(current);
            current = String::new();
            continue;
        }
        current.push(ch);
    }
    values.push(current);
    values
}

fn run_upload_stages(
    ctx: &RunInput,
    config: &FileStoreConfig,
    account: &Account,
    upload_statement_date: Option<&str>,
    financial_year: Option<&str>,
    run_ctx: &RunContext,
) -> Result<Vec<StatementWarning>, StageError> {
    raise_if_cancelled(run_ctx)?;
    let workspace = ctx.account_workspace(account);
    let cleanup_result = cleanup::run_account(
        config,
        &workspace,
        account,
        upload_statement_date,
        financial_year,
        run_ctx,
    )?;
    let warnings = cleanup_result.warnings;
    raise_if_cancelled(run_ctx)?;
    metadata::refresh_account_metadata(
        config,
        account,
        financial_year,
        &cleanup_result.prepared_statements,
        run_ctx,
    )?;
    raise_if_cancelled(run_ctx)?;
    parse::run_account_parse(
        config,
        account,
        financial_year,
        &cleanup_result.prepared_statements,
        run_ctx,
    )?;
    Ok(warnings)
}
