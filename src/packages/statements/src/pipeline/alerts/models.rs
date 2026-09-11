use crate::domain::StatementWarning;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AlertKind {
    TextContainsMissing,
    AmbiguousStatementPeriod,
    PdfOpenFailed,
}

impl AlertKind {
    pub fn as_str(self) -> &'static str {
        match self {
            AlertKind::TextContainsMissing => "text_contains_missing",
            AlertKind::AmbiguousStatementPeriod => "ambiguous_statement_period",
            AlertKind::PdfOpenFailed => "pdf_open_failed",
        }
    }
}

#[derive(Debug, Clone)]
pub struct Alert {
    pub kind: AlertKind,
    pub message: String,
    pub account: String,
    pub source_file: String,
    pub text_contains: Vec<String>,
}

impl Alert {
    pub fn to_statement_warning(&self) -> StatementWarning {
        StatementWarning {
            kind: self.kind.as_str().to_string(),
            message: self.message.clone(),
            account: self.account.clone(),
            source_file: self.source_file.clone(),
            text_contains: self.text_contains.clone(),
        }
    }
}
