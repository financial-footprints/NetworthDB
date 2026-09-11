//! Structured stage results (NetworthCSV `pipeline/results` port).

use std::path::PathBuf;

use crate::domain::StatementWarning;

use crate::pipeline::cleanup::models::PreparedStatement;

#[derive(Debug, Clone)]
pub struct ExtractAccountResult {
    pub bank: String,
    pub download_dir: PathBuf,
    pub messages_matched: u32,
    pub attachments_saved: u32,
}

#[derive(Debug, Clone)]
pub struct ExtractStageResult {
    pub accounts: Vec<ExtractAccountResult>,
}

#[derive(Debug, Clone)]
pub struct CleanupAccountResult {
    pub bank: String,
    pub download_dir: PathBuf,
    pub unsupported_staging_removed: u32,
    pub decrypted: u32,
    pub prepared: u32,
    pub rejected: u32,
    pub orphans_removed: u32,
    pub skipped: bool,
    pub warnings: Vec<StatementWarning>,
    pub prepared_statements: Vec<PreparedStatement>,
}

#[derive(Debug, Clone)]
pub struct DeleteAccountResult {
    pub bank: String,
    pub download_dir: PathBuf,
    pub files_removed: u32,
    pub dirs_removed: u32,
}
