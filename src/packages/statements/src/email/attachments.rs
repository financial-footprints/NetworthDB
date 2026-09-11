//! MIME attachment extraction and staging writes (NetworthCSV `email_message.py` port).

use std::path::Path;

use chrono::{Datelike, NaiveDate};
use mail_parser::{Message, MessageParser, MessagePart, MimeHeaders, PartType};

use crate::domain::Account;
use crate::vault::path::unique_path;
use crate::zip::{
    extract_statements_from_zip, sanitize_zip_member_name, ZipArchiveError,
    ZipNoStatementFilesError, ZipPasswordError,
};

use super::sanitize_filename;

const PDF_MAGIC: &[u8] = b"%PDF";

pub struct ParsedEmail {
    message: Message<'static>,
}

impl ParsedEmail {
    pub fn parse(raw: &[u8]) -> Option<Self> {
        let message = MessageParser::default().parse(raw)?.into_owned();
        Some(Self { message })
    }

    pub fn subject(&self) -> String {
        self.message.subject().unwrap_or_default().to_string()
    }

    pub fn from(&self) -> String {
        self.message
            .from()
            .and_then(|addr| addr.first())
            .and_then(|addr| addr.address.as_deref())
            .map(|s| s.to_string())
            .unwrap_or_default()
    }

    pub fn received(&self) -> Option<NaiveDate> {
        message_date(&self.message)
    }

    pub fn body(&self) -> String {
        extract_message_body(&self.message)
    }

    pub fn attachment_names(&self) -> Vec<String> {
        attachment_filenames(&self.message)
    }

    pub fn matches_account(
        &self,
        account: &Account,
        start_date: Option<NaiveDate>,
        end_date: Option<NaiveDate>,
    ) -> Result<bool, crate::errors::StageError> {
        super::matching::effective_mail_matches_account(
            &super::matching::MailMatchInput {
                subject: &self.subject(),
                from: &self.from(),
                received: self.received(),
                body: &self.body(),
                attachment_names: &self.attachment_names(),
                start_date,
                end_date,
            },
            account,
        )
    }

    pub fn save_attachments(
        &self,
        download_dir: &Path,
        folder_prefix: &str,
        account: &Account,
    ) -> usize {
        save_attachments_from_message(&self.message, download_dir, folder_prefix, account)
    }
}

pub fn message_date(message: &Message<'_>) -> Option<NaiveDate> {
    message
        .date()
        .and_then(|dt| NaiveDate::from_ymd_opt(dt.year as i32, dt.month as u32, dt.day as u32))
}

fn extract_message_body(message: &Message<'_>) -> String {
    let mut parts = Vec::new();
    for idx in 0..message.text_body_count() {
        if let Some(body) = message.body_text(idx) {
            parts.push(body.to_string());
        }
    }
    for idx in 0..message.html_body_count() {
        if let Some(body) = message.body_html(idx) {
            parts.push(body.to_string());
        }
    }
    parts.join("\n")
}

fn attachment_filenames(message: &Message<'_>) -> Vec<String> {
    message
        .attachments()
        .filter_map(|part| part.attachment_name().map(sanitize_filename))
        .collect()
}

fn is_annual_email(message: &Message<'_>) -> bool {
    let subject = message.subject().unwrap_or_default().to_lowercase();
    if subject.contains("annual") || subject.contains("year end") {
        return true;
    }
    let body = extract_message_body(message).to_lowercase();
    body.contains("annual") || body.contains("year end")
}

fn part_contents(part: &MessagePart<'_>) -> Option<Vec<u8>> {
    match &part.body {
        PartType::Binary(data) => Some(data.to_vec()),
        PartType::Text(text) => Some(text.as_bytes().to_vec()),
        PartType::Html(html) => Some(html.as_bytes().to_vec()),
        _ => None,
    }
}

fn is_pdf_attachment(part: &MessagePart<'_>, annual: bool) -> bool {
    if part
        .attachment_name()
        .map(sanitize_filename)
        .is_some_and(|n| n.to_ascii_lowercase().ends_with(".pdf"))
    {
        return true;
    }
    if part.is_content_type("application", "pdf") {
        return true;
    }
    if annual && part.is_content_type("application", "octet-stream") {
        return part_contents(part).is_some_and(|p| p.starts_with(PDF_MAGIC));
    }
    false
}

fn is_csv_attachment(part: &MessagePart<'_>) -> bool {
    if part
        .attachment_name()
        .map(sanitize_filename)
        .is_some_and(|n| n.to_ascii_lowercase().ends_with(".csv"))
    {
        return true;
    }
    part.is_content_type("text", "csv")
        || part.is_content_type("application", "csv")
        || part.is_content_type("application", "vnd.ms-excel")
}

fn is_zip_attachment(part: &MessagePart<'_>) -> bool {
    part.attachment_name()
        .map(sanitize_filename)
        .is_some_and(|n| n.to_ascii_lowercase().ends_with(".zip"))
}

fn attachment_filename(message: &Message<'_>, original: &str, annual: bool) -> String {
    let original = sanitize_filename(original);
    let suffix = Path::new(&original)
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy().to_ascii_lowercase()))
        .unwrap_or_default();
    let stem = message_date(message)
        .map(|d| format!("{:04}-{:02}-{:02}", d.year(), d.month(), d.day()))
        .unwrap_or_else(|| "unknown-date".to_string());
    let suffix = if suffix.eq_ignore_ascii_case(".pdf") {
        ".pdf".to_string()
    } else if suffix.eq_ignore_ascii_case(".csv") {
        ".csv".to_string()
    } else if suffix.is_empty() && is_annual_email(message) {
        ".pdf".to_string()
    } else {
        suffix
    };
    if annual && suffix == ".csv" {
        return format!("{}__annual{}", stem, suffix);
    }
    if suffix.is_empty() {
        stem
    } else {
        format!("{}{}", stem, suffix)
    }
}

fn download_filename_for_extracted_member(
    message: &Message<'_>,
    inner_name: &str,
    annual: bool,
) -> String {
    let stem = message_date(message)
        .map(|d| format!("{:04}-{:02}-{:02}", d.year(), d.month(), d.day()))
        .unwrap_or_else(|| "unknown-date".to_string());
    let safe_inner = sanitize_zip_member_name(inner_name);
    if annual {
        format!("{}__annual__{}", stem, safe_inner)
    } else {
        format!("{}__{}", stem, safe_inner)
    }
}

pub fn save_attachments_from_message(
    message: &Message<'_>,
    download_dir: &Path,
    folder_prefix: &str,
    account: &Account,
) -> usize {
    let _ = std::fs::create_dir_all(download_dir);
    let prefix = if folder_prefix.is_empty() {
        String::new()
    } else {
        format!("{}__", folder_prefix)
    };
    let annual = is_annual_email(message);
    let mut saved = 0usize;

    for part in message.attachments() {
        let filename = part.attachment_name().unwrap_or("attachment");
        if is_pdf_attachment(part, annual) || is_csv_attachment(part) {
            let payload = part_contents(part).unwrap_or_default();
            let is_csv = sanitize_filename(filename)
                .to_ascii_lowercase()
                .ends_with(".csv");
            let safe_name = attachment_filename(message, filename, annual && is_csv);
            let dest = unique_path(download_dir, &format!("{}{}", prefix, safe_name));
            if std::fs::write(&dest, &payload).is_ok() {
                saved += 1;
            }
            continue;
        }
        if is_zip_attachment(part) {
            let payload = part_contents(part).unwrap_or_default();
            match extract_statements_from_zip(&payload, &account.passwords) {
                Ok(extracted) => {
                    for item in extracted {
                        let safe_name = download_filename_for_extracted_member(
                            message,
                            &item.inner_name,
                            annual,
                        );
                        let dest = unique_path(download_dir, &format!("{}{}", prefix, safe_name));
                        if std::fs::write(&dest, &item.content).is_ok() {
                            saved += 1;
                        }
                    }
                }
                Err(err) if err.downcast_ref::<ZipPasswordError>().is_some() => {}
                Err(err) if err.downcast_ref::<ZipNoStatementFilesError>().is_some() => {}
                Err(err) if err.downcast_ref::<ZipArchiveError>().is_some() => {}
                Err(_) => {}
            }
        }
    }

    saved
}
