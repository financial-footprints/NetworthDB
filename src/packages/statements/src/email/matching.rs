//! Effective mail matching config (handler defaults + account overlay).

use crate::banks::handlers::get_handler;
use crate::domain::Account;
use crate::errors::StageError;

use super::message::{body_matches, from_matches, message_in_date_range, subject_matches};

#[derive(Debug, Clone)]
pub struct EffectiveMailConfig {
    pub subjects: Vec<String>,
    pub body_contains: Vec<String>,
    pub from: Vec<String>,
}

pub struct MailMatchInput<'a> {
    pub subject: &'a str,
    pub from: &'a str,
    pub received: Option<chrono::NaiveDate>,
    pub body: &'a str,
    pub attachment_names: &'a [String],
    pub start_date: Option<chrono::NaiveDate>,
    pub end_date: Option<chrono::NaiveDate>,
}

pub fn effective_mail_for_account(account: &Account) -> Result<EffectiveMailConfig, StageError> {
    let handler = get_handler(&account.bank, account.variant.as_deref())?;
    let default_subjects = handler.mail_subjects();
    match account.mail.as_ref() {
        None => Ok(EffectiveMailConfig {
            subjects: default_subjects,
            body_contains: vec![],
            from: vec![],
        }),
        Some(overlay) => Ok(EffectiveMailConfig {
            subjects: if overlay.subjects.is_empty() {
                default_subjects
            } else {
                overlay.subjects.clone()
            },
            body_contains: overlay.body_contains.clone(),
            from: overlay.from_addresses.clone(),
        }),
    }
}

pub fn effective_mail_matches_account(
    input: &MailMatchInput<'_>,
    account: &Account,
) -> Result<bool, StageError> {
    let mail = effective_mail_for_account(account)?;
    if !subject_matches(input.subject, &mail.subjects) {
        return Ok(false);
    }
    if !from_matches(input.from, &mail.from) {
        return Ok(false);
    }
    if !message_in_date_range(input.received, input.start_date, input.end_date) {
        return Ok(false);
    }
    if input.attachment_names.is_empty() {
        return Ok(false);
    }
    Ok(body_matches(
        input.body,
        input.attachment_names,
        &mail.body_contains,
    ))
}
