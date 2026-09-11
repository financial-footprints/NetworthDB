#![allow(dead_code)]

use ::napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::domain::convert::account_vault_stub;
use crate::pipeline::upload::{
    canonical_statement_exists, save_manual_upload_pdf, save_uploaded_csv, save_uploaded_zip,
};
use crate::vault::path::statement_relative_path;
use crate::vault::store::read_bytes;
use crate::vault::workspace;

use super::runtime::{data_key_buffer, file_store_for_user, store_error};
use super::types::{StatementFileInput, WriteUploadInput, WriteUploadResult};

fn canonical_relative(
    account_type: &str,
    account_id: &str,
    format: &str,
    statement_date: Option<&str>,
) -> Result<String> {
    let format = format.to_lowercase();
    let statement_date = statement_date.filter(|d| !d.is_empty()).ok_or_else(|| {
        Error::new(
            Status::GenericFailure,
            "statements.pipeline.upload.invalid.statement-date-required",
        )
    })?;
    if format != "pdf" && format != "csv" {
        return Err(Error::new(
            Status::GenericFailure,
            "statements.pipeline.upload.invalid-format",
        ));
    }
    Ok(statement_relative_path(
        account_type,
        account_id,
        statement_date,
        &format,
    ))
}

#[napi(js_name = "writeUpload")]
pub fn write_upload(input: WriteUploadInput) -> Result<WriteUploadResult> {
    let config = file_store_for_user(&input.user_id, data_key_buffer(input.data_key))?;
    let account = account_vault_stub(
        &input.account_id,
        &input.account_type,
        input.passwords.clone(),
    );
    let workspace_dir =
        workspace::account_workspace(&input.user_id, &input.account_type, &input.account_id);
    let format = input.format.to_lowercase();
    let relative = match format.as_str() {
        "pdf" => {
            let statement_date = input
                .statement_date
                .as_deref()
                .filter(|d| !d.is_empty())
                .ok_or_else(|| {
                    Error::new(
                        Status::GenericFailure,
                        "statement_date required for pdf upload",
                    )
                })?;
            save_manual_upload_pdf(&workspace_dir, statement_date, input.data.as_ref())
                .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))?;
            format!(
                "workspace/{}/{}/manual__{}.pdf",
                input.account_type, input.account_id, statement_date
            )
        }
        "csv" => {
            let statement_date = input
                .statement_date
                .as_deref()
                .filter(|d| !d.is_empty())
                .ok_or_else(|| {
                    Error::new(
                        Status::GenericFailure,
                        "statement_date required for csv upload",
                    )
                })?;
            save_uploaded_csv(&config, &account, statement_date, input.data.as_ref())
                .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))?;
            statement_relative_path(
                &input.account_type,
                &input.account_id,
                statement_date,
                "csv",
            )
        }
        "zip" => {
            save_uploaded_zip(&workspace_dir, &account, input.data.as_ref())
                .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))?;
            format!("workspace/{}/{}/", input.account_type, input.account_id)
        }
        _ => {
            return Err(Error::new(
                Status::GenericFailure,
                "statements.pipeline.upload.invalid-format",
            ));
        }
    };
    Ok(WriteUploadResult { relative })
}

#[napi(js_name = "statementFileExists")]
pub fn statement_file_exists(input: StatementFileInput) -> Result<bool> {
    let config = file_store_for_user(&input.user_id, data_key_buffer(input.data_key))?;
    let format = input.format.to_lowercase();
    if format == "zip" {
        let workspace_dir =
            workspace::account_workspace(&input.user_id, &input.account_type, &input.account_id);
        return Ok(workspace::list_files(&workspace_dir)
            .map(|files| !files.is_empty())
            .unwrap_or(false));
    }
    let statement_date = input.statement_date.as_deref();
    let account = account_vault_stub(&input.account_id, &input.account_type, vec![]);
    if let Some(date) = statement_date.filter(|d| !d.is_empty()) {
        return Ok(canonical_statement_exists(&config, &account, date, &format));
    }
    Ok(false)
}

#[napi(js_name = "readStatementFile")]
pub fn read_statement_file(input: StatementFileInput) -> Result<Option<Buffer>> {
    let config = file_store_for_user(&input.user_id, data_key_buffer(input.data_key))?;
    let relative = canonical_relative(
        &input.account_type,
        &input.account_id,
        &input.format,
        input.statement_date.as_deref(),
    )?;
    match read_bytes(&config, &relative).map_err(store_error)? {
        Some(data) => Ok(Some(Buffer::from(data))),
        None => Ok(None),
    }
}
