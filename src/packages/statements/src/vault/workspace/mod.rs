//! Ephemeral plaintext workspace for extract, ZIP explode, and PDF decrypt.

use std::fs;
use std::path::{Path, PathBuf};

use crate::errors::StageError;
use crate::vault::runtime::ephemeral_path;

pub fn account_workspace(user_id: &str, account_type: &str, account_id: &str) -> PathBuf {
    ephemeral_path()
        .join(user_id)
        .join(account_type)
        .join(account_id)
}

pub fn ensure_dir(path: &Path) -> Result<(), StageError> {
    fs::create_dir_all(path).map_err(|e| StageError::new(e.to_string()))
}

pub fn write_file(path: &Path, data: &[u8]) -> Result<(), StageError> {
    if let Some(parent) = path.parent() {
        ensure_dir(parent)?;
    }
    fs::write(path, data).map_err(|e| StageError::new(e.to_string()))
}

pub fn read_file(path: &Path) -> Result<Option<Vec<u8>>, StageError> {
    if !path.is_file() {
        return Ok(None);
    }
    fs::read(path)
        .map(Some)
        .map_err(|e| StageError::new(e.to_string()))
}

pub fn list_files(dir: &Path) -> Result<Vec<PathBuf>, StageError> {
    if !dir.is_dir() {
        return Ok(vec![]);
    }
    let mut paths = Vec::new();
    let entries = fs::read_dir(dir).map_err(|e| StageError::new(e.to_string()))?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            paths.push(path);
        }
    }
    paths.sort();
    Ok(paths)
}

pub fn clear_dir(dir: &Path) -> Result<(), StageError> {
    if !dir.is_dir() {
        return Ok(());
    }
    let entries = fs::read_dir(dir).map_err(|e| StageError::new(e.to_string()))?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            let _ = fs::remove_file(&path);
        }
    }
    Ok(())
}
