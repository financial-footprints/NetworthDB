//! Statement cleanup stage (NetworthCSV `pipeline/cleanup` port).

mod canonical;
mod exclusion;
mod grouping;
mod keeper;
pub mod models;
mod orphans;
mod prepare_common;
mod prepare_csv_month;
mod prepare_month;
mod run;
mod staging;

use crate::domain::Account;
use crate::errors::StageError;
use crate::pdf::extract_pdf_text_from_bytes;
use crate::vault::path::{
    manual_upload_staging_relative, statement_relative_path, statement_txt_relative,
};
use crate::vault::store::{read_bytes, unlink, write_bytes, FileStoreConfig};

pub use run::run_account;

pub fn run_upload_pdf_cleanup(
    config: &FileStoreConfig,
    account: &Account,
    statement_date: &str,
) -> Result<(), StageError> {
    let staging_relative =
        manual_upload_staging_relative(&account.account_type, &account.id, statement_date);
    let pdf_bytes = read_bytes(config, &staging_relative)
        .map_err(|e| StageError::new(e.to_string()))?
        .ok_or_else(|| StageError::new(format!("staging file not found: {}", staging_relative)))?;

    let handler = crate::banks::handlers::get_handler(&account.bank, account.variant.as_deref())?;
    let raw = extract_pdf_text_from_bytes(&pdf_bytes, &account.passwords)
        .map_err(|e| StageError::new(e.message.clone()))?;
    let cleaned = handler.clean_text(&raw);

    let pdf_out =
        statement_relative_path(&account.account_type, &account.id, statement_date, "pdf");
    let txt_out = statement_txt_relative(&account.account_type, &account.id, statement_date);

    write_bytes(config, &pdf_out, &pdf_bytes).map_err(|e| StageError::new(e.to_string()))?;
    write_bytes(config, &txt_out, cleaned.as_bytes())
        .map_err(|e| StageError::new(e.to_string()))?;

    unlink(config, &staging_relative).map_err(|e| StageError::new(e.to_string()))?;
    Ok(())
}
