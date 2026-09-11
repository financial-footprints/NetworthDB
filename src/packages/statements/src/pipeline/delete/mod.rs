//! Delete account statement artifacts.

use std::path::Path;

use crate::domain::Account;
use crate::errors::StageError;
use crate::pipeline::results::DeleteAccountResult;
use crate::vault::path::account_metadata_relative;
use crate::vault::store::{list, unlink, FileStoreConfig};
use crate::vault::workspace;

pub fn collect_account_output_relatives(
    config: &FileStoreConfig,
    account: &Account,
) -> Result<Vec<String>, StageError> {
    let segment = format!("/{}/{}/", account.account_type, account.id);
    let keys = list(config, None)?;
    Ok(keys
        .into_iter()
        .filter(|key| {
            key.contains(&segment)
                || key == &account_metadata_relative(&account.account_type, &account.id)
        })
        .collect())
}

pub fn delete_account_statements(
    config: &FileStoreConfig,
    workspace_dir: &Path,
    account: &Account,
) -> Result<DeleteAccountResult, StageError> {
    let relatives = collect_account_output_relatives(config, account)?;
    let mut files_removed = 0u32;
    for relative in relatives {
        if unlink(config, &relative).is_ok() {
            files_removed += 1;
        }
    }
    let _ = workspace::clear_dir(workspace_dir);

    Ok(DeleteAccountResult {
        bank: account.bank.clone(),
        download_dir: workspace_dir.to_path_buf(),
        files_removed,
        dirs_removed: 0,
    })
}
