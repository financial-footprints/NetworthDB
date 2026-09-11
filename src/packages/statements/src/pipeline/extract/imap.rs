//! IMAP extract (NetworthCSV `get_statements/imap.py` port).

use crate::domain::{Account, Source};

use crate::email::{
    build_imap_search_criteria, effective_mail_for_account, sanitize_filename, ParsedEmail,
    ReadOnlyImapClient, IMAP_FETCH_MAX_ATTEMPTS,
};
use crate::errors::StageError;
use crate::period::{format_account_date, resolve_account_search_dates, utc_today};
use crate::pipeline::context::{raise_if_cancelled, RunContext};
use crate::pipeline::metadata::{read_last_fetch_date, write_last_fetch_date};
use crate::pipeline::results::ExtractAccountResult;
use crate::run::RunInput;
use serde_json::json;

fn uid_fetch_with_retry(
    client: &mut ReadOnlyImapClient,
    uid: &str,
) -> Result<Option<Vec<u8>>, StageError> {
    let mut attempts = 0u32;
    loop {
        attempts += 1;
        match client.uid_fetch_body_peek(uid) {
            Ok(body) => return Ok(body),
            Err(err) if ReadOnlyImapClient::is_connection_lost(&err)
                && attempts < IMAP_FETCH_MAX_ATTEMPTS =>
            {
                client.reconnect()?;
            }
            Err(err) => return Err(err),
        }
    }
}

fn extract_account(
    client: &mut ReadOnlyImapClient,
    run_ctx: &RunContext,
    ctx: &RunInput,
    account: &Account,
    source: &Source,
    folder_label: &str,
) -> Result<ExtractAccountResult, StageError> {
    let host = source
        .host()
        .filter(|value| !value.is_empty())
        .ok_or_else(|| StageError::new("email source missing host"))?;
    let config = ctx.file_store_config()?;
    let download_dir = ctx.account_workspace(account);
    crate::vault::workspace::ensure_dir(&download_dir)?;

    let last_fetch = read_last_fetch_date(&config, account)?;
    let (effective_start, search_end) = resolve_account_search_dates(account, last_fetch);

    let mail = effective_mail_for_account(account)?;
    let (charset, criteria) =
        build_imap_search_criteria(&mail.subjects, effective_start, host, search_end);

    if run_ctx.trace_enabled() {
        run_ctx.trace_info(
            "extract",
            "imap search filters",
            Some(json!({
                "accountId": account.id,
                "accountType": account.account_type,
                "bank": account.bank,
                "variant": account.variant,
                "label": account.label,
                "host": host,
                "folder": source
                    .folder()
                    .filter(|value| !value.is_empty())
                    .unwrap_or("INBOX"),
                "lastFetchDate": last_fetch.map(format_account_date),
                "startDate": effective_start.map(format_account_date),
                "endDate": search_end.map(format_account_date),
                "subjects": mail.subjects,
                "bodyContains": mail.body_contains,
                "fromAddresses": mail.from,
                "searchCharset": charset,
                "searchCriteria": criteria,
            })),
        );
    }

    let charset_opt = charset;
    let uids = client.search(charset_opt, &criteria)?;
    let search_uid_count = uids.len();

    if run_ctx.trace_enabled() {
        run_ctx.trace_info(
            "extract",
            "imap search uid count",
            Some(json!({
                "accountId": account.id,
                "label": account.label,
                "uidCount": search_uid_count,
            })),
        );
    }

    client.noop()?;

    let mut messages_matched = 0u32;
    let mut attachments_saved = 0u32;
    let mut post_filter_rejected = 0u32;
    let mut parse_failed = 0u32;
    for (index, uid) in uids.into_iter().enumerate() {
        raise_if_cancelled(run_ctx)?;
        let body = uid_fetch_with_retry(client, &uid)?;
        let Some(raw) = body else { continue };
        let Some(parsed) = ParsedEmail::parse(&raw) else {
            parse_failed += 1;
            continue;
        };
        if !parsed.matches_account(account, effective_start, search_end)? {
            post_filter_rejected += 1;
            continue;
        }
        messages_matched += 1;
        attachments_saved += parsed.save_attachments(&download_dir, folder_label, account) as u32;

        let fetched = index + 1;
        if fetched % 10 == 0 {
            client.noop()?;
            if run_ctx.trace_enabled() {
                run_ctx.trace_info(
                    "extract",
                    "imap fetch progress",
                    Some(json!({
                        "accountId": account.id,
                        "label": account.label,
                        "fetched": fetched,
                        "total": search_uid_count,
                    })),
                );
            }
        }
    }

    if run_ctx.trace_enabled() {
        run_ctx.trace_info(
            "extract",
            "imap search results",
            Some(json!({
                "accountId": account.id,
                "label": account.label,
                "searchUidCount": search_uid_count,
                "messagesMatched": messages_matched,
                "postFilterRejected": post_filter_rejected,
                "parseFailed": parse_failed,
                "attachmentsSaved": attachments_saved,
            })),
        );
    }

    write_last_fetch_date(&config, account, utc_today())?;

    Ok(ExtractAccountResult {
        bank: account.bank.clone(),
        download_dir,
        messages_matched,
        attachments_saved,
    })
}

pub fn run_imap_extract(
    ctx: &RunInput,
    run_ctx: &RunContext,
    accounts: &[Account],
    source: &Source,
) -> Result<Vec<ExtractAccountResult>, StageError> {
    let host = source
        .host()
        .filter(|value| !value.is_empty())
        .ok_or_else(|| StageError::new("email source missing host"))?;
    let port = source.port().unwrap_or(993) as u16;
    let username = source
        .username()
        .filter(|value| !value.is_empty())
        .ok_or_else(|| StageError::new("email source missing username"))?;
    let password = source.password().unwrap_or("");
    let folder = source
        .folder()
        .filter(|value| !value.is_empty())
        .unwrap_or("INBOX");
    let use_ssl = source.use_ssl();
    let folder_label = sanitize_filename(folder);

    let mut client =
        ReadOnlyImapClient::connect(host, port, username, password, use_ssl, folder)?;
    client.examine(folder)?;

    let mut results = Vec::new();
    for account in accounts {
        raise_if_cancelled(run_ctx)?;
        results.push(extract_account(
            &mut client,
            run_ctx,
            ctx,
            account,
            source,
            &folder_label,
        )?);
    }

    let _ = client.close();
    let _ = client.logout();
    Ok(results)
}
