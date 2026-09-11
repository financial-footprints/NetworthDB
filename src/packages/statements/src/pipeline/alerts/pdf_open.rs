use std::path::Path;

use crate::domain::Account;
use crate::pdf::{pdf_open_failure, source_file_name, PdfError, PdfOpenFailureKind};

use super::models::{Alert, AlertKind};
use super::service::AlertService;

pub fn emit_pdf_open_alert(
    alerts: &mut AlertService,
    account: &Account,
    path: &Path,
    err: &PdfError,
) {
    let source_file = source_file_name(path);
    if alerts
        .alerts()
        .iter()
        .any(|alert| alert.kind == AlertKind::PdfOpenFailed && alert.source_file == source_file)
    {
        return;
    }

    let failure = pdf_open_failure(path, err);
    let message = match failure.kind {
        PdfOpenFailureKind::IncorrectPassword => {
            format!("Configured passwords did not open {}", source_file)
        }
        PdfOpenFailureKind::UnsupportedEncryption => format!(
            "PDF uses encryption that cannot be handled: {}",
            source_file
        ),
        PdfOpenFailureKind::Other => failure.message,
    };

    alerts.emit(Alert {
        kind: AlertKind::PdfOpenFailed,
        message,
        account: format!("{}/{}", account.bank, account.id),
        source_file,
        text_contains: Vec::new(),
    });
}
