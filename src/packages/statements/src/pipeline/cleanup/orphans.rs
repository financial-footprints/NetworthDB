use crate::domain::Account;
use crate::errors::StageError;
use crate::vault::path::{list_monthly_pdf_relatives, statement_txt_relative};
use crate::vault::store::{exists, unlink, FileStoreConfig};

pub fn sweep_orphans(
    config: &FileStoreConfig,
    account: &Account,
    financial_year: Option<&str>,
) -> Result<u32, StageError> {
    let mut removed = 0u32;
    for pdf_relative in
        list_monthly_pdf_relatives(config, &account.account_type, &account.id, financial_year)
            .map_err(|e| StageError::new(e.to_string()))?
    {
        let stem = pdf_relative
            .rsplit('/')
            .next()
            .and_then(|name| name.strip_suffix(".pdf"))
            .unwrap_or("");
        let txt_relative = statement_txt_relative(&account.account_type, &account.id, stem);
        if exists(config, &txt_relative) {
            continue;
        }
        if unlink(config, &pdf_relative).is_ok() {
            removed += 1;
        }
    }

    let prefix =
        financial_year.map(|fy| format!("{}/{}/{}/", fy, account.account_type, account.id));
    let keys = crate::vault::store::list(config, prefix.as_deref())
        .map_err(|e| StageError::new(e.to_string()))?;
    for key in keys {
        if !key.ends_with(".txt") {
            continue;
        }
        if key.contains("transactions-") {
            continue;
        }
        let stem = key
            .rsplit('/')
            .next()
            .and_then(|name| name.strip_suffix(".txt"))
            .unwrap_or("");
        let pdf_relative = crate::vault::path::statement_relative_path(
            &account.account_type,
            &account.id,
            stem,
            "pdf",
        );
        if exists(config, &pdf_relative) {
            continue;
        }
        if unlink(config, &key).is_ok() {
            removed += 1;
        }
    }

    Ok(removed)
}
