//! Pipeline validation alerts (NetworthCSV `utils/alerts` port).

mod models;
mod pdf_open;
mod service;

pub use crate::domain::StatementWarning;
pub use models::{Alert, AlertKind};
pub use pdf_open::emit_pdf_open_alert;
pub use service::AlertService;
