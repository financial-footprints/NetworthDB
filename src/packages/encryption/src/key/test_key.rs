use super::decode_key;
use crate::nwenc::DATA_KEY_LEN;

const TEST_KEY_HEX: &str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

#[test]
fn decode_key_accepts_hex() {
    let key = decode_key(TEST_KEY_HEX).expect("decode hex key");
    assert_eq!(key.len(), DATA_KEY_LEN);
}

#[test]
fn decode_key_rejects_wrong_length() {
    let err = decode_key("abcd").unwrap_err();
    assert!(err.to_string().contains("invalid-length"));
}

#[test]
fn decode_key_rejects_empty() {
    let err = decode_key("   ").unwrap_err();
    assert!(err.to_string().contains("empty"));
}

#[test]
fn decode_key_rejects_invalid_encoding() {
    let err = decode_key("!!!not-a-valid-key!!!").unwrap_err();
    assert!(err.to_string().contains("invalid-encoding"));
}
