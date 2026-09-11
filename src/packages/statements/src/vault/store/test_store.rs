use std::fs;

use super::{exists, read_bytes, write_bytes, FileStoreConfig};
use encryption::nwenc::DATA_KEY_LEN;

#[test]
fn plaintext_round_trip() {
    let dir = std::env::temp_dir().join(format!("ndb-store-plain-{}", std::process::id()));
    fs::create_dir_all(&dir).expect("mkdir");
    let config = FileStoreConfig {
        tenant_root: dir.clone(),
        encrypt_at_rest: false,
        data_key: None,
    };
    let relative = "FY23-2024/credit_card/acct-1/2024-01.pdf";
    write_bytes(&config, relative, b"pdf-content").expect("write");
    assert!(exists(&config, relative));
    let data = read_bytes(&config, relative).expect("read").expect("some");
    assert_eq!(data, b"pdf-content");
    fs::remove_dir_all(&dir).ok();
}

#[test]
fn encrypted_round_trip() {
    let dir = std::env::temp_dir().join(format!("ndb-store-enc-{}", std::process::id()));
    fs::create_dir_all(&dir).expect("mkdir");
    let key = vec![0xABu8; DATA_KEY_LEN];
    let config = FileStoreConfig {
        tenant_root: dir.clone(),
        encrypt_at_rest: true,
        data_key: Some(key),
    };
    let relative = "FY24-2025/credit_card/acct-1/2024-04.pdf";
    write_bytes(&config, relative, b"secret").expect("write");
    let enc_path = config.encrypted_path(relative);
    assert!(enc_path.is_file());
    assert!(enc_path.to_string_lossy().ends_with(".nwenc"));
    let data = read_bytes(&config, relative).expect("read").expect("some");
    assert_eq!(data, b"secret");
    fs::remove_dir_all(&dir).ok();
}
