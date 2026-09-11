use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct StatementWarning {
    pub kind: String,
    pub message: String,
    pub account: String,
    pub source_file: String,
    pub text_contains: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ProcessResult {
    pub ok: bool,
    pub reason: Option<String>,
    pub warnings: Vec<StatementWarning>,
    pub logs: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Bank {
    pub key: String,
    pub bank: String,
    pub variant: Option<String>,
    pub account_type: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TransactionRow {
    pub date: String,
    pub description: String,
    pub ref_no: String,
    pub credited: String,
    pub debited: String,
    pub source_file: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AccountTransactions {
    pub period: String,
    pub is_annual: bool,
    pub rows: Vec<TransactionRow>,
}
