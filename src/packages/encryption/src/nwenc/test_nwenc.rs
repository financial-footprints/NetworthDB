use super::{
    decrypt_bytes, encrypt_bytes, encrypt_bytes_with_nonce, is_encrypted_blob, DATA_KEY_LEN,
};

const GOLDEN_KEY: [u8; DATA_KEY_LEN] = [
    0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef, 0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef,
    0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef, 0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef,
];
const GOLDEN_NONCE: [u8; 12] = [
    0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x1b,
];
const GOLDEN_PLAINTEXT: &[u8] = br#"{"passwords":["secret"]}"#;

#[test]
fn encrypt_decrypt_round_trip() {
    let key = [0xABu8; DATA_KEY_LEN];
    let plaintext = GOLDEN_PLAINTEXT;
    let blob = encrypt_bytes(&key, plaintext).expect("encrypt");
    assert!(is_encrypted_blob(&blob));
    let decrypted = decrypt_bytes(&key, &blob).expect("decrypt");
    assert_eq!(decrypted, plaintext);
}

#[test]
fn decrypt_rejects_plaintext() {
    let key = [0u8; DATA_KEY_LEN];
    let err = decrypt_bytes(&key, b"plain").unwrap_err();
    assert!(err.to_string().contains("not-nwenc1-blob"));
}

#[test]
fn rejects_wrong_key_length() {
    let key = [0u8; 16];
    let err = encrypt_bytes(&key, b"x").unwrap_err();
    assert!(err.to_string().contains("key-length"));
}

#[test]
fn golden_vector_decrypt() {
    let blob = encrypt_bytes_with_nonce(&GOLDEN_KEY, GOLDEN_PLAINTEXT, &GOLDEN_NONCE)
        .expect("encrypt with fixed nonce");
    let decrypted = decrypt_bytes(&GOLDEN_KEY, &blob).expect("decrypt golden blob");
    assert_eq!(decrypted, GOLDEN_PLAINTEXT);
}
