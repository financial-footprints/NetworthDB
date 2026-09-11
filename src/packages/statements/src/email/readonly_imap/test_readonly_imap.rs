use super::{
    normalize_mailbox_name, quote_imap_string, IMAP_CONNECT_TIMEOUT, IMAP_READ_TIMEOUT,
    IMAP_WRITE_TIMEOUT, ReadOnlyImapClient,
};
use crate::errors::StageError;

#[test]
fn is_connection_lost_detects_imap_connection_lost_message() {
    let err = StageError::new("IMAP fetch failed: Connection Lost");
    assert!(ReadOnlyImapClient::is_connection_lost(&err));
}

#[test]
fn is_connection_lost_ignores_unrelated_errors() {
    let err = StageError::new("IMAP login failed: invalid credentials");
    assert!(!ReadOnlyImapClient::is_connection_lost(&err));
}

#[test]
fn imap_timeout_constants_are_non_zero() {
    assert!(IMAP_CONNECT_TIMEOUT.as_secs() > 0);
    assert!(IMAP_READ_TIMEOUT.as_secs() > 0);
    assert!(IMAP_WRITE_TIMEOUT.as_secs() > 0);
}

#[test]
fn normalize_mailbox_name_defaults_empty_to_inbox() {
    assert_eq!(normalize_mailbox_name(""), "INBOX");
    assert_eq!(normalize_mailbox_name("   "), "INBOX");
}

#[test]
fn normalize_mailbox_name_preserves_inbox_case_insensitive() {
    assert_eq!(normalize_mailbox_name("INBOX"), "INBOX");
    assert_eq!(normalize_mailbox_name("inbox"), "INBOX");
    assert_eq!(normalize_mailbox_name("  inbox  "), "INBOX");
}

#[test]
fn normalize_mailbox_name_does_not_quote_gmail_all_mail() {
    let folder = "[Gmail]/All Mail";
    let normalized = normalize_mailbox_name(folder);
    assert_eq!(normalized, folder);
    assert!(!normalized.starts_with('"'));
    assert!(!normalized.ends_with('"'));
}

#[test]
fn normalize_mailbox_name_trims_whitespace_without_quoting() {
    assert_eq!(
        normalize_mailbox_name("  [Gmail]/All Mail  "),
        "[Gmail]/All Mail"
    );
}

#[test]
fn quote_imap_string_still_quotes_search_terms_with_spaces() {
    assert_eq!(quote_imap_string("has:attachment"), "\"has:attachment\"");
    assert_eq!(
        quote_imap_string("subject:\"Statement\""),
        "\"subject:\\\"Statement\\\"\""
    );
}
