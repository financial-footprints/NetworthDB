use crate::banks::helpers::text_not_contains_violated;
use crate::domain::Account;

pub fn statement_should_exclude(
    raw: &str,
    sanitized: &str,
    account: &Account,
    is_manual: bool,
) -> bool {
    if is_manual {
        return false;
    }
    let markers = account
        .statement
        .as_ref()
        .map(|s| s.text_not_contains.as_slice())
        .unwrap_or(&[]);
    text_not_contains_violated(raw, markers) || text_not_contains_violated(sanitized, markers)
}
