use std::fs;
use std::path::Path;

use crate::domain::Account;
use crate::period::{exclusive_search_end_date, parse_closing_date, parse_opening_date};

use super::attachments::ParsedEmail;

fn regalia_account() -> Account {
    Account {
        id: "df5030d0-0646-43cf-bb0f-3a7bc0483b6f".to_string(),
        user_id: "user-1".to_string(),
        bank: "hdfc".to_string(),
        variant: Some("regalia".to_string()),
        label: "hdfc (regalia)".to_string(),
        account_type: "credit_card".to_string(),
        opening_date: "2022-08-21".to_string(),
        closing_date: Some("2023-10-20".to_string()),
        account_number: String::new(),
        passwords: vec![],
        mail: None,
        statement: None,
        created_at: String::new(),
        updated_at: String::new(),
    }
}

#[test]
fn forwarded_regalia_statement_passes_post_filter_with_closing_date() {
    let fixture = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../regalia.eml");
    let raw = fs::read(&fixture).unwrap_or_else(|err| {
        panic!("failed to read {}: {}", fixture.display(), err);
    });
    let parsed = ParsedEmail::parse(&raw).expect("regalia.eml should parse");
    let account = regalia_account();
    let start = parse_opening_date(&account.opening_date);
    let end = account
        .closing_date
        .as_deref()
        .and_then(parse_closing_date)
        .map(exclusive_search_end_date);
    assert!(
        parsed.matches_account(&account, start, end).expect("match check"),
        "forwarded Regalia statement should match via MIME Date header, not mailbox received date"
    );
}
