use super::{get_handler, list_handler_keys};
use crate::banks::parsers::get_parser;

const EXPECTED_HANDLER_COUNT: usize = 27;

#[test]
fn list_handler_keys_returns_full_registry() {
    let keys = list_handler_keys();
    assert_eq!(
        keys.len(),
        EXPECTED_HANDLER_COUNT,
        "expected {} handler keys, got {}: {:?}",
        EXPECTED_HANDLER_COUNT,
        keys.len(),
        keys
    );
    assert!(keys.contains(&"onecard/default".to_string()));
    assert!(keys.contains(&"hdfc/swiggy".to_string()));
    assert!(keys.contains(&"icici/amazon".to_string()));
}

#[test]
fn every_handler_key_resolves() {
    for key in list_handler_keys() {
        let parts: Vec<&str> = key.split('/').collect();
        assert_eq!(parts.len(), 2, "unexpected key shape: {}", key);
        let handler = get_handler(parts[0], Some(parts[1])).expect("handler");
        let _ = handler.mail_subjects();
    }
}

#[test]
fn parser_fallback_uses_bank_default() {
    assert!(get_parser("hdfc", Some("swiggy")).is_ok());
    assert!(get_parser("hdfc", Some("tata-neu-infinity")).is_ok());
    assert!(get_parser("idfc", None).is_ok());
    assert!(get_parser("idfc", Some("wow")).is_ok());
    assert!(get_parser("icici", Some("coral")).is_ok());
}
