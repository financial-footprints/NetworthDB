use std::fs;
use std::path::Path;

use crate::banks::handlers::get_handler;
use crate::banks::helpers::statement_text_eligible;
use crate::domain::Account;
use crate::errors::StageError;
use crate::pipeline::cleanup::exclusion::statement_should_exclude;
use crate::pipeline::cleanup::models::PreparedStatement;
use crate::pipeline::cleanup::staging::{is_staging_csv, is_staging_pdf};
use crate::vault::path::{
    list_monthly_pdf_relatives, statement_relative_path, statement_txt_relative,
};
use crate::vault::store::{exists, read_bytes, unlink, write_bytes, FileStoreConfig};

pub fn sanitized_text(raw: &str, account: &Account) -> Result<String, StageError> {
    let handler = get_handler(&account.bank, account.variant.as_deref())?;
    Ok(handler.clean_text(raw))
}

pub fn write_statement_pair(
    config: &FileStoreConfig,
    staging_dir: &Path,
    account: &Account,
    month: &str,
    keeper: &Path,
    raw: &str,
) -> Result<PreparedStatement, StageError> {
    let pdf_relative = statement_relative_path(&account.account_type, &account.id, month, "pdf");
    let txt_relative = statement_txt_relative(&account.account_type, &account.id, month);
    let purged = sanitized_text(raw, account)?;

    let pdf_bytes = fs::read(keeper).map_err(|e| StageError::new(e.to_string()))?;
    if !exists(config, &pdf_relative) {
        write_bytes(config, &pdf_relative, &pdf_bytes)
            .map_err(|e| StageError::new(e.to_string()))?;
    }
    write_bytes(config, &txt_relative, purged.as_bytes())
        .map_err(|e| StageError::new(e.to_string()))?;

    if is_staging_pdf(staging_dir, keeper) {
        let _ = fs::remove_file(keeper);
    }

    Ok(PreparedStatement {
        period: month.to_string(),
        cleaned_text: purged,
        pdf_bytes: Some(pdf_bytes),
        source_csv: None,
    })
}

pub fn write_statement_csv(
    config: &FileStoreConfig,
    staging_dir: &Path,
    account: &Account,
    month: &str,
    keeper: &Path,
) -> Result<PreparedStatement, StageError> {
    let csv_relative = statement_relative_path(&account.account_type, &account.id, month, "csv");
    let csv_bytes = fs::read(keeper).map_err(|e| StageError::new(e.to_string()))?;
    if !exists(config, &csv_relative) {
        write_bytes(config, &csv_relative, &csv_bytes)
            .map_err(|e| StageError::new(e.to_string()))?;
    }

    if is_staging_csv(staging_dir, keeper) {
        let _ = fs::remove_file(keeper);
    }

    Ok(PreparedStatement {
        period: month.to_string(),
        cleaned_text: String::from_utf8_lossy(&csv_bytes).into_owned(),
        pdf_bytes: None,
        source_csv: Some(csv_bytes),
    })
}

pub fn prune_ineligible(
    config: &FileStoreConfig,
    account: &Account,
    financial_year: Option<&str>,
) -> Result<u32, StageError> {
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
    let mut removed = 0u32;

    for pdf_relative in
        list_monthly_pdf_relatives(config, &account.account_type, &account.id, financial_year)
            .map_err(|e| StageError::new(e.to_string()))?
    {
        let txt_relative = statement_txt_relative(&account.account_type, &account.id, {
            let stem = pdf_relative
                .rsplit('/')
                .next()
                .and_then(|name| name.strip_suffix(".pdf"))
                .unwrap_or("");
            stem
        });
        if !exists(config, &txt_relative) {
            continue;
        }
        let txt_bytes = read_bytes(config, &txt_relative)
            .map_err(|e| StageError::new(e.to_string()))?
            .unwrap_or_default();
        let txt_content = String::from_utf8_lossy(&txt_bytes);
        if statement_should_exclude(&txt_content, &txt_content, account, false) {
            unlink(config, &pdf_relative).map_err(|e| StageError::new(e.to_string()))?;
            unlink(config, &txt_relative).map_err(|e| StageError::new(e.to_string()))?;
            removed += 1;
            continue;
        }
        if statement_text_eligible(&txt_content, &text_contains, &text_not_contains, false) {
            continue;
        }
        unlink(config, &pdf_relative).map_err(|e| StageError::new(e.to_string()))?;
        unlink(config, &txt_relative).map_err(|e| StageError::new(e.to_string()))?;
        removed += 1;
    }

    let csv_keys = list_monthly_statement_csv_relatives(config, account, financial_year)?;
    for csv_relative in csv_keys {
        let csv_bytes = read_bytes(config, &csv_relative)
            .map_err(|e| StageError::new(e.to_string()))?
            .unwrap_or_default();
        let csv_content = String::from_utf8_lossy(&csv_bytes);
        if statement_should_exclude(&csv_content, &csv_content, account, false) {
            unlink(config, &csv_relative).map_err(|e| StageError::new(e.to_string()))?;
            removed += 1;
            continue;
        }
        if statement_text_eligible(&csv_content, &text_contains, &text_not_contains, false) {
            continue;
        }
        unlink(config, &csv_relative).map_err(|e| StageError::new(e.to_string()))?;
        removed += 1;
    }

    Ok(removed)
}

fn list_monthly_statement_csv_relatives(
    config: &FileStoreConfig,
    account: &Account,
    financial_year: Option<&str>,
) -> Result<Vec<String>, StageError> {
    let segment = format!("/{}/{}/", account.account_type, account.id);
    let prefix =
        financial_year.map(|fy| format!("{}/{}/{}/", fy, account.account_type, account.id));
    let keys = crate::vault::store::list(config, prefix.as_deref())
        .map_err(|e| StageError::new(e.to_string()))?;
    Ok(keys
        .into_iter()
        .filter(|key| {
            key.contains(&segment)
                && key.ends_with(".csv")
                && !key.contains("transactions-")
                && key
                    .rsplit('/')
                    .next()
                    .and_then(|stem| stem.strip_suffix(".csv"))
                    .map(|stem| {
                        crate::period::parse_month_period(stem).is_some()
                            || crate::period::is_calendar_year_period(stem)
                    })
                    .unwrap_or(false)
        })
        .collect())
}
