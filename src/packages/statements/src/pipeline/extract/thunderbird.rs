//! Thunderbird mbox extract (NetworthCSV `get_statements/thunderbird.py` port).

use std::path::Path;

use crate::domain::{Account, Source};

use crate::email::{discover_mbox_files, iter_mbox_messages, sanitize_filename};
use crate::errors::StageError;
use crate::period::{resolve_account_search_dates, utc_today};
use crate::pipeline::context::{raise_if_cancelled, RunContext};
use crate::pipeline::metadata::{read_last_fetch_date, write_last_fetch_date};
use crate::pipeline::results::ExtractAccountResult;
use crate::run::RunInput;

fn process_mbox(
    mbox_path: &Path,
    account: &Account,
    download_dir: &Path,
    folder_prefix: &str,
    start_date: Option<chrono::NaiveDate>,
    end_date: Option<chrono::NaiveDate>,
) -> Result<(u32, u32), StageError> {
    let mut messages_matched = 0u32;
    let mut attachments_saved = 0u32;
    for parsed in iter_mbox_messages(mbox_path) {
        if !parsed.matches_account(account, start_date, end_date)? {
            continue;
        }
        messages_matched += 1;
        attachments_saved += parsed.save_attachments(download_dir, folder_prefix, account) as u32;
    }
    Ok((messages_matched, attachments_saved))
}

pub fn run_account(
    ctx: &RunInput,
    run_ctx: &RunContext,
    account: &Account,
    source: &Source,
) -> Result<ExtractAccountResult, StageError> {
    raise_if_cancelled(run_ctx)?;
    let profile_value = source
        .profile()
        .filter(|value| !value.is_empty())
        .ok_or_else(|| StageError::new("thunderbird source missing profile config"))?;
    let profile = Path::new(profile_value);
    if !profile.is_dir() {
        return Err(StageError::new(format!(
            "profile directory not found: {}",
            profile.display()
        )));
    }

    let config = ctx.file_store_config()?;
    let download_dir = ctx.account_workspace(account);
    crate::vault::workspace::ensure_dir(&download_dir)?;

    let last_fetch = read_last_fetch_date(&config, account)?;
    let (effective_start, effective_end) = resolve_account_search_dates(account, last_fetch);

    let mbox_files = discover_mbox_files(profile);
    if mbox_files.is_empty() {
        return Err(StageError::new("no mbox stores found"));
    }

    let mut total_messages = 0u32;
    let mut attachments_saved = 0u32;
    for mbox_path in &mbox_files {
        raise_if_cancelled(run_ctx)?;
        let folder_label = sanitize_filename(
            &mbox_path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| "mbox".to_string()),
        );
        let (matched, saved) = process_mbox(
            mbox_path,
            account,
            &download_dir,
            &folder_label,
            effective_start,
            effective_end,
        )?;
        total_messages += matched;
        attachments_saved += saved;
    }

    write_last_fetch_date(&config, account, utc_today())?;

    Ok(ExtractAccountResult {
        bank: account.bank.clone(),
        download_dir,
        messages_matched: total_messages,
        attachments_saved,
    })
}
