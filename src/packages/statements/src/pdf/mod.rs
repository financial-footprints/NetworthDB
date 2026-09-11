//! Password-protected PDF decrypt and text extract (NetworthCSV `utils/pdf` port).

mod text_pdf;

use std::fs;
use std::path::Path;

use lopdf::{Document, LoadOptions};
use thiserror::Error;

use crate::errors::StageError;
use crate::zip::password_candidates;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PdfOpenFailureKind {
    IncorrectPassword,
    UnsupportedEncryption,
    Other,
}

#[derive(Debug, Clone)]
pub struct PdfOpenFailure {
    pub kind: PdfOpenFailureKind,
    pub message: String,
}

#[derive(Debug, Error)]
#[error("{message}")]
pub struct PdfError {
    pub message: String,
}

impl PdfError {
    pub fn message(&self) -> &str {
        &self.message
    }
}

impl PdfError {
    fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
        }
    }
}

impl From<PdfError> for StageError {
    fn from(err: PdfError) -> Self {
        StageError::new(err.message)
    }
}

pub fn classify_pdf_open_detail(detail: &str) -> PdfOpenFailureKind {
    let lower = detail.to_ascii_lowercase();
    if lower.contains("the supplied password is incorrect")
        || lower.contains("invalid padding encountered when decrypting")
    {
        PdfOpenFailureKind::IncorrectPassword
    } else if lower.contains("unsupported key length")
        || lower.contains("invalid key length")
        || lower.contains("unsupported revision")
        || lower.contains("encryption revision is not implemented")
        || lower.contains("encryption scheme that is not")
        || lower.contains("encryption version is not implemented")
    {
        PdfOpenFailureKind::UnsupportedEncryption
    } else {
        PdfOpenFailureKind::Other
    }
}

pub fn pdf_open_failure_from_error(err: &PdfError) -> PdfOpenFailure {
    let message = err.message().to_string();
    let detail = message
        .rsplit_once(": ")
        .map(|(_, detail)| detail)
        .unwrap_or(message.as_str());
    PdfOpenFailure {
        kind: classify_pdf_open_detail(detail),
        message,
    }
}

pub fn pdf_open_failure(path: &Path, err: &PdfError) -> PdfOpenFailure {
    let mut failure = pdf_open_failure_from_error(err);
    if !failure.message.contains(path.to_string_lossy().as_ref()) {
        failure.message = format!("could not open {}: {}", path.display(), failure.message);
    }
    failure
}

fn try_open_document(data: &[u8], password: Option<&str>) -> Result<Document, String> {
    let options = match password {
        Some(pw) if !pw.is_empty() => LoadOptions::with_password(pw),
        _ => LoadOptions::default(),
    };
    Document::load_mem_with_options(data, options).map_err(|err| err.to_string())
}

fn extract_text_from_document(doc: &Document) -> Result<String, PdfError> {
    let page_numbers: Vec<u32> = doc.get_pages().keys().copied().collect();
    if page_numbers.is_empty() {
        return Ok(String::new());
    }
    doc.extract_text(&page_numbers)
        .map_err(|err| PdfError::new(format!("pdf text extract failed: {}", err)))
}

fn extract_pdf_text_with_detail(
    detail_prefix: &str,
    data: &[u8],
    passwords: &[String],
) -> Result<String, PdfError> {
    let candidates = password_candidates(passwords);
    let mut last_error: Option<String> = None;

    for password in &candidates {
        let pw = if password.is_empty() {
            None
        } else {
            Some(password.as_str())
        };
        match try_open_document(data, pw) {
            Ok(doc) => return extract_text_from_document(&doc),
            Err(err) => {
                last_error = Some(err);
            }
        }
    }

    let detail = last_error.map(|e| format!(": {}", e)).unwrap_or_default();
    Err(PdfError::new(format!("{}{}", detail_prefix, detail)))
}

pub fn extract_pdf_text_from_bytes(data: &[u8], passwords: &[String]) -> Result<String, PdfError> {
    extract_pdf_text_with_detail("could not open pdf", data, passwords)
}

pub use text_pdf::write_text_pdf;

pub fn extract_pdf_text(path: &Path, passwords: &[String]) -> Result<String, PdfError> {
    let data = fs::read(path)
        .map_err(|err| PdfError::new(format!("could not read {}: {}", path.display(), err)))?;
    extract_pdf_text_with_detail(
        &format!("could not open {}", path.display()),
        &data,
        passwords,
    )
}

pub fn source_file_name(path: &Path) -> String {
    path.file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.display().to_string())
}

#[cfg(test)]
mod test_pdf;
