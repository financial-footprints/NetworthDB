use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};

use crate::errors::StageError;
use crate::vault::path::{to_posix_relative, NWENC_SUFFIX};
use encryption::nwenc::{decrypt_bytes, encrypt_bytes, is_encrypted_blob, NwencError};

const VAULT_DIR: &str = ".vault";

#[derive(Debug, thiserror::Error)]
pub enum StoreError {
    #[error("statements.store.io.{0}")]
    Io(String),
    #[error("{0}")]
    Nwenc(NwencError),
    #[error("statements.store.invalid.key-required")]
    KeyRequired,
}

impl From<StoreError> for StageError {
    fn from(err: StoreError) -> Self {
        StageError::new(err.to_string())
    }
}

pub struct FileStoreConfig {
    pub tenant_root: PathBuf,
    pub encrypt_at_rest: bool,
    pub data_key: Option<Vec<u8>>,
}

impl FileStoreConfig {
    pub fn vault_root(&self) -> PathBuf {
        self.tenant_root.join(VAULT_DIR)
    }

    fn plaintext_path(&self, relative: &str) -> PathBuf {
        self.vault_root().join(relative)
    }

    fn encrypted_path(&self, relative: &str) -> PathBuf {
        self.vault_root()
            .join(format!("{}{}", relative, NWENC_SUFFIX))
    }
}

pub fn write_bytes(
    config: &FileStoreConfig,
    relative: &str,
    data: &[u8],
) -> Result<(), StoreError> {
    let relative = to_posix_relative(relative);
    if config.encrypt_at_rest {
        let key = config.data_key.as_ref().ok_or(StoreError::KeyRequired)?;
        let encrypted = encrypt_bytes(key, data).map_err(StoreError::Nwenc)?;
        let target = config.encrypted_path(&relative);
        let parent = target
            .parent()
            .map(Path::to_path_buf)
            .unwrap_or_else(|| config.vault_root());
        fs::create_dir_all(&parent).map_err(|e| StoreError::Io(e.to_string()))?;
        fs::write(&target, encrypted).map_err(|e| StoreError::Io(e.to_string()))?;
        return Ok(());
    }

    let target = config.plaintext_path(&relative);
    let parent = target
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| config.vault_root());
    fs::create_dir_all(&parent).map_err(|e| StoreError::Io(e.to_string()))?;
    fs::write(&target, data).map_err(|e| StoreError::Io(e.to_string()))?;
    Ok(())
}

pub fn read_bytes(config: &FileStoreConfig, relative: &str) -> Result<Option<Vec<u8>>, StoreError> {
    let relative = to_posix_relative(relative);
    let plain = config.plaintext_path(&relative);
    if plain.is_file() {
        return fs::read(&plain)
            .map(Some)
            .map_err(|e| StoreError::Io(e.to_string()));
    }

    let enc = config.encrypted_path(&relative);
    if !enc.is_file() {
        return Ok(None);
    }

    let blob = fs::read(&enc).map_err(|e| StoreError::Io(e.to_string()))?;
    if !is_encrypted_blob(&blob) {
        return Ok(Some(blob));
    }

    let key = config.data_key.as_ref().ok_or(StoreError::KeyRequired)?;
    decrypt_bytes(key, &blob)
        .map(Some)
        .map_err(StoreError::Nwenc)
}

pub fn exists(config: &FileStoreConfig, relative: &str) -> bool {
    let relative = to_posix_relative(relative);
    config.plaintext_path(&relative).is_file() || config.encrypted_path(&relative).is_file()
}

pub fn unlink(config: &FileStoreConfig, relative: &str) -> Result<(), StoreError> {
    let relative = to_posix_relative(relative);
    let plain = config.plaintext_path(&relative);
    let enc = config.encrypted_path(&relative);
    if plain.is_file() {
        fs::remove_file(&plain).map_err(|e| StoreError::Io(e.to_string()))?;
    }
    if enc.is_file() {
        fs::remove_file(&enc).map_err(|e| StoreError::Io(e.to_string()))?;
    }
    Ok(())
}

/// List vault objects as posix relative keys (without `.nwenc` suffix).
pub fn list(config: &FileStoreConfig, prefix: Option<&str>) -> Result<Vec<String>, StoreError> {
    let vault_root = config.vault_root();
    if !vault_root.is_dir() {
        return Ok(vec![]);
    }
    let prefix = prefix.map(to_posix_relative);
    let mut keys = BTreeSet::new();
    collect_keys(&vault_root, &vault_root, prefix.as_deref(), &mut keys)?;
    Ok(keys.into_iter().collect())
}

fn collect_keys(
    vault_root: &Path,
    current: &Path,
    prefix: Option<&str>,
    keys: &mut BTreeSet<String>,
) -> Result<(), StoreError> {
    let entries = fs::read_dir(current).map_err(|e| StoreError::Io(e.to_string()))?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect_keys(vault_root, &path, prefix, keys)?;
            continue;
        }
        if !path.is_file() {
            continue;
        }
        let relative = path
            .strip_prefix(vault_root)
            .map_err(|e| StoreError::Io(e.to_string()))?
            .to_string_lossy();
        let relative = to_posix_relative(relative.as_ref());
        let key = if relative.ends_with(NWENC_SUFFIX) {
            relative
                .strip_suffix(NWENC_SUFFIX)
                .unwrap_or(&relative)
                .to_string()
        } else {
            relative
        };
        if prefix.is_some_and(|p| !key.starts_with(p)) {
            continue;
        }
        keys.insert(key);
    }
    Ok(())
}

#[cfg(test)]
mod test_store;
