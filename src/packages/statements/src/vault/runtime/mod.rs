use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use crate::vault::store::{FileStoreConfig, StoreError};

pub const EPHEMERAL_DIR_NAME: &str = "networthdb-ephemeral";
const DEFAULT_FILESTORE_PATH: &str = "/tmp/networthdb";
const DEFAULT_ENVIRONMENT: &str = "local";

#[derive(Debug, Clone)]
pub struct StatementsRuntime {
    pub filestore_path: PathBuf,
    pub ephemeral_path: PathBuf,
    pub encrypt_at_rest: bool,
}

#[derive(Debug, thiserror::Error)]
pub enum RuntimeError {
    #[error("statements.runtime.invalid.filestore-path-required")]
    FilestorePathRequired,
    #[error("statements.runtime.invalid.not-initialized")]
    NotInitialized,
    #[error("statements.runtime.io.{0}")]
    Io(String),
}

static RUNTIME: Mutex<Option<StatementsRuntime>> = Mutex::new(None);

pub fn ephemeral_path() -> PathBuf {
    std::env::temp_dir().join(EPHEMERAL_DIR_NAME)
}

fn environment_from_env() -> String {
    std::env::var("ENVIRONMENT")
        .ok()
        .filter(|v| !v.is_empty())
        .unwrap_or_else(|| DEFAULT_ENVIRONMENT.to_string())
}

pub(crate) fn encrypt_at_rest_from_environment(environment: &str) -> bool {
    environment != "local"
}

pub fn from_env() -> Result<StatementsRuntime, RuntimeError> {
    let environment = environment_from_env();
    let encrypt_at_rest = encrypt_at_rest_from_environment(&environment);

    let filestore_path = if environment == "production" {
        match std::env::var("FILESTORE_PATH")
            .ok()
            .filter(|v| !v.is_empty())
        {
            Some(path) => PathBuf::from(path),
            None => return Err(RuntimeError::FilestorePathRequired),
        }
    } else {
        std::env::var("FILESTORE_PATH")
            .ok()
            .filter(|v| !v.is_empty())
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from(DEFAULT_FILESTORE_PATH))
    };

    Ok(StatementsRuntime {
        filestore_path,
        ephemeral_path: ephemeral_path(),
        encrypt_at_rest,
    })
}

pub fn init(runtime: StatementsRuntime) -> Result<(), RuntimeError> {
    fs::create_dir_all(&runtime.filestore_path).map_err(|e| RuntimeError::Io(e.to_string()))?;
    fs::create_dir_all(&runtime.ephemeral_path).map_err(|e| RuntimeError::Io(e.to_string()))?;

    let mut guard = RUNTIME
        .lock()
        .map_err(|_| RuntimeError::Io("runtime lock poisoned".to_string()))?;
    *guard = Some(runtime);
    Ok(())
}

pub fn init_from_env() -> Result<(), RuntimeError> {
    init(from_env()?)
}

pub fn init_with(
    filestore_path: Option<PathBuf>,
    encrypt_at_rest: Option<bool>,
) -> Result<(), RuntimeError> {
    let base = from_env()?;
    let runtime = StatementsRuntime {
        filestore_path: filestore_path.unwrap_or(base.filestore_path),
        ephemeral_path: ephemeral_path(),
        encrypt_at_rest: encrypt_at_rest.unwrap_or(base.encrypt_at_rest),
    };
    init(runtime)
}

pub fn current() -> Result<StatementsRuntime, RuntimeError> {
    let guard = RUNTIME
        .lock()
        .map_err(|_| RuntimeError::Io("runtime lock poisoned".to_string()))?;
    guard.clone().ok_or(RuntimeError::NotInitialized)
}

pub fn file_store(user_id: &str, data_key: Option<Vec<u8>>) -> Result<FileStoreConfig, StoreError> {
    let runtime = current().map_err(|_| StoreError::KeyRequired)?;
    if runtime.encrypt_at_rest && data_key.is_none() {
        return Err(StoreError::KeyRequired);
    }
    Ok(FileStoreConfig {
        tenant_root: runtime.filestore_path.join(user_id),
        encrypt_at_rest: runtime.encrypt_at_rest,
        data_key,
    })
}

#[cfg(test)]
mod test_runtime;
