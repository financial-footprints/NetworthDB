//! AES ZIP archive extract (NetworthCSV `utils/zip_archive` port).

use std::io::{Cursor, Read};
use std::path::Path;

use thiserror::Error;
use zip::read::ZipArchive;
use zip::result::ZipError;

use crate::errors::StageError;

#[derive(Debug, Error)]
#[error("{message}")]
pub struct ZipArchiveError {
    pub message: String,
}

impl ZipArchiveError {
    fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
        }
    }
}

#[derive(Debug, Error)]
#[error("configured password(s) did not open zip archive (also tried empty password)")]
pub struct ZipPasswordError {
    #[source]
    source: Option<Box<dyn std::error::Error + Send + Sync>>,
}

#[derive(Debug, Error)]
#[error("zip archive contains no csv files")]
pub struct ZipNoCsvError;

#[derive(Debug, Error)]
#[error("zip archive contains no statement files")]
pub struct ZipNoStatementFilesError;

#[derive(Debug, Clone)]
pub struct ExtractedCsv {
    pub inner_name: String,
    pub content: Vec<u8>,
}

pub fn sanitize_zip_member_name(name: &str) -> String {
    let normalized = name.replace('\\', "/");
    let normalized = Path::new(&normalized)
        .components()
        .map(|c| c.as_os_str().to_string_lossy())
        .collect::<Vec<_>>()
        .join("/");
    let parts: Vec<&str> = normalized.split('/').filter(|p| !p.is_empty()).collect();
    if parts.is_empty() || normalized == "." || normalized == ".." {
        return "attachment".to_string();
    }
    let leaf = parts.last().unwrap();
    if leaf.is_empty() || *leaf == "." || *leaf == ".." {
        return "attachment".to_string();
    }
    leaf.to_string()
}

fn is_safe_zip_member(name: &str) -> bool {
    let normalized = name.replace('\\', "/");
    if normalized.starts_with("../") || normalized.starts_with('/') {
        return false;
    }
    let parts: Vec<&str> = normalized.split('/').filter(|p| !p.is_empty()).collect();
    if parts.contains(&"..") {
        return false;
    }
    if parts.first() == Some(&"__MACOSX") {
        return false;
    }
    !parts.iter().any(|p| p.starts_with('.'))
}

fn is_csv_member(name: &str) -> bool {
    sanitize_zip_member_name(name)
        .to_ascii_lowercase()
        .ends_with(".csv")
}

fn is_pdf_member(name: &str) -> bool {
    sanitize_zip_member_name(name)
        .to_ascii_lowercase()
        .ends_with(".pdf")
}

fn is_statement_member(name: &str) -> bool {
    is_csv_member(name) || is_pdf_member(name)
}

pub fn password_candidates(passwords: &[String]) -> Vec<String> {
    let mut seen = std::collections::HashSet::new();
    let mut out = vec![String::new()];
    seen.insert(String::new());
    for password in passwords {
        if seen.insert(password.clone()) {
            out.push(password.clone());
        }
    }
    out
}

fn extract_members(
    data: &[u8],
    password: &str,
    is_target: fn(&str) -> bool,
) -> Result<Vec<ExtractedCsv>, ZipArchiveError> {
    let cursor = Cursor::new(data);
    let mut archive = match ZipArchive::new(cursor) {
        Ok(a) => a,
        Err(ZipError::InvalidArchive(msg)) => {
            return Err(ZipArchiveError::new(format!(
                "invalid zip archive: {}",
                msg
            )));
        }
        Err(err) => return Err(ZipArchiveError::new(err.to_string())),
    };

    let mut extracted = vec![];
    for i in 0..archive.len() {
        let mut file = match archive.by_index_decrypt(i, password.as_bytes()) {
            Ok(f) => f,
            Err(ZipError::InvalidPassword) => {
                return Err(ZipArchiveError::new("bad password"));
            }
            Err(ZipError::UnsupportedArchive(msg)) if msg.contains("password") => {
                return Err(ZipArchiveError::new(
                    "encrypted zip member requires password",
                ));
            }
            Err(err) => return Err(ZipArchiveError::new(err.to_string())),
        };

        if file.is_dir() {
            continue;
        }
        let name = file.name().to_string();
        if !is_safe_zip_member(&name) {
            continue;
        }
        if !is_target(&name) {
            continue;
        }

        let mut content = vec![];
        if file.read_to_end(&mut content).is_err() {
            return Err(ZipArchiveError::new("failed to read zip member"));
        }
        extracted.push(ExtractedCsv {
            inner_name: sanitize_zip_member_name(&name),
            content,
        });
    }

    if extracted.is_empty() {
        return Err(ZipArchiveError::new(
            "zip archive contains no statement files",
        ));
    }
    Ok(extracted)
}

fn extract_with_passwords(
    data: &[u8],
    passwords: &[String],
    is_target: fn(&str) -> bool,
    no_members_error: &str,
) -> Result<Vec<ExtractedCsv>, Box<dyn std::error::Error + Send + Sync>> {
    let candidates = password_candidates(passwords);
    let mut last_error: Option<ZipArchiveError> = None;

    for password in &candidates {
        match extract_members(data, password, is_target) {
            Ok(items) => return Ok(items),
            Err(ZipArchiveError { message })
                if message.contains("no statement files") || message.contains("no csv") =>
            {
                if no_members_error.contains("no csv") {
                    return Err(ZipNoCsvError.into());
                }
                return Err(ZipNoStatementFilesError.into());
            }
            Err(ZipArchiveError { message }) if message.contains("invalid zip archive") => {
                return Err(ZipArchiveError::new(message).into());
            }
            Err(err) => {
                last_error = Some(err);
                continue;
            }
        }
    }

    if let Some(err) = last_error {
        return Err(ZipPasswordError {
            source: Some(Box::new(err)),
        }
        .into());
    }

    if no_members_error.contains("no csv") {
        Err(ZipNoCsvError.into())
    } else {
        Err(ZipNoStatementFilesError.into())
    }
}

pub fn extract_csvs_from_zip(
    data: &[u8],
    passwords: &[String],
) -> Result<Vec<ExtractedCsv>, Box<dyn std::error::Error + Send + Sync>> {
    extract_with_passwords(
        data,
        passwords,
        is_csv_member,
        "zip archive contains no csv files",
    )
}

pub fn extract_statements_from_zip(
    data: &[u8],
    passwords: &[String],
) -> Result<Vec<ExtractedCsv>, Box<dyn std::error::Error + Send + Sync>> {
    extract_with_passwords(
        data,
        passwords,
        is_statement_member,
        "zip archive contains no statement files",
    )
}

impl From<ZipArchiveError> for StageError {
    fn from(err: ZipArchiveError) -> Self {
        StageError::new(err.message)
    }
}

#[cfg(test)]
mod test_zip;
