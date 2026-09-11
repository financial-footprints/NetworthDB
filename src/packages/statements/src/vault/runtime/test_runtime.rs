use super::{
    encrypt_at_rest_from_environment, ephemeral_path, file_store, from_env, init,
    StatementsRuntime, EPHEMERAL_DIR_NAME,
};
use std::path::PathBuf;
use std::sync::Mutex;

static ENV_LOCK: Mutex<()> = Mutex::new(());

fn with_env(vars: &[(&str, Option<&str>)], f: impl FnOnce()) {
    let _guard = ENV_LOCK.lock().expect("env test lock");

    let keys: Vec<String> = vars.iter().map(|(k, _)| k.to_string()).collect();
    let previous: Vec<(String, Option<String>)> = keys
        .iter()
        .map(|key| (key.clone(), std::env::var(key).ok()))
        .collect();

    for (key, value) in vars {
        match value {
            Some(v) => std::env::set_var(key, v),
            None => std::env::remove_var(key),
        }
    }

    f();

    for (key, value) in previous {
        match value {
            Some(v) => std::env::set_var(&key, v),
            None => std::env::remove_var(&key),
        }
    }
}

#[test]
fn from_env_local_defaults_when_filestore_path_unset() {
    with_env(
        &[("ENVIRONMENT", Some("local")), ("FILESTORE_PATH", None)],
        || {
            let runtime = from_env().expect("from_env");
            assert_eq!(runtime.filestore_path, PathBuf::from("/tmp/networthdb"));
            assert!(!runtime.encrypt_at_rest);
            assert!(runtime.ephemeral_path.ends_with(EPHEMERAL_DIR_NAME));
        },
    );
}

#[test]
fn from_env_production_requires_filestore_path() {
    with_env(
        &[
            ("ENVIRONMENT", Some("production")),
            ("FILESTORE_PATH", None),
        ],
        || {
            let err = from_env().expect_err("should fail");
            assert!(err.to_string().contains("filestore-path-required"));
        },
    );
}

#[test]
fn file_store_tenant_root_joins_user_id() {
    with_env(
        &[
            ("ENVIRONMENT", Some("local")),
            ("FILESTORE_PATH", Some("/data/filestore")),
        ],
        || {
            let runtime = from_env().expect("from_env");
            let dir = std::env::temp_dir().join(format!("ndb-runtime-test-{}", std::process::id()));
            let runtime = StatementsRuntime {
                filestore_path: dir.clone(),
                ephemeral_path: ephemeral_path(),
                encrypt_at_rest: runtime.encrypt_at_rest,
            };
            init(runtime).expect("init");
            let config = file_store("user-abc", None).expect("file_store");
            assert_eq!(config.tenant_root, dir.join("user-abc"));
            std::fs::remove_dir_all(&dir).ok();
        },
    );
}

#[test]
fn ephemeral_path_is_under_temp_dir() {
    let path = ephemeral_path();
    assert!(path.starts_with(std::env::temp_dir()));
    assert!(path.ends_with(EPHEMERAL_DIR_NAME));
}

#[test]
fn encrypt_at_rest_false_for_local() {
    assert!(!encrypt_at_rest_from_environment("local"));
    assert!(encrypt_at_rest_from_environment("production"));
}
