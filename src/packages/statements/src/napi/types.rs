#![cfg(feature = "napi")]

use napi_derive::napi;

#[napi(object)]
pub struct StatementsRuntimeConfig {
    #[napi(js_name = "filestorePath")]
    pub filestore_path: Option<String>,
    #[napi(js_name = "encryptAtRest")]
    pub encrypt_at_rest: Option<bool>,
}

#[napi(object)]
pub struct MailRules {
    pub subjects: Vec<String>,
    #[napi(js_name = "bodyContains")]
    pub body_contains: Vec<String>,
    #[napi(js_name = "fromAddresses")]
    pub from_addresses: Vec<String>,
}

#[napi(object)]
pub struct StatementRules {
    #[napi(js_name = "textContains")]
    pub text_contains: Vec<String>,
    #[napi(js_name = "textNotContains")]
    pub text_not_contains: Vec<String>,
}

#[napi(object, use_nullable = true)]
pub struct Account {
    pub id: String,
    #[napi(js_name = "userId")]
    pub user_id: String,
    #[napi(js_name = "accountType")]
    pub account_type: String,
    pub bank: String,
    pub variant: Option<String>,
    pub label: String,
    #[napi(js_name = "openingDate")]
    pub opening_date: String,
    #[napi(js_name = "closingDate")]
    pub closing_date: Option<String>,
    #[napi(js_name = "accountNumber")]
    pub account_number: String,
    pub passwords: Vec<String>,
    pub mail: Option<MailRules>,
    pub statement: Option<StatementRules>,
    #[napi(js_name = "createdAt")]
    pub created_at: String,
    #[napi(js_name = "updatedAt")]
    pub updated_at: String,
}

#[napi(object, use_nullable = true)]
pub struct JobScope {
    #[napi(js_name = "accountId")]
    pub account_id: Option<String>,
    #[napi(js_name = "financialYear")]
    pub financial_year: Option<String>,
}

#[napi(object, use_nullable = true)]
pub struct SourceNapi {
    pub id: String,
    #[napi(ts_type = "'thunderbird' | 'email'")]
    pub r#type: String,
    pub label: String,
    pub profile: Option<String>,
    pub host: Option<String>,
    pub port: Option<u32>,
    pub username: Option<String>,
    pub password: Option<String>,
    pub folder: Option<String>,
    #[napi(js_name = "useSsl")]
    pub use_ssl: Option<bool>,
}

#[napi(object, use_nullable = true)]
pub struct StatementsRun {
    #[napi(js_name = "userId")]
    pub user_id: String,
    pub scope: JobScope,
    pub accounts: Vec<Account>,
    pub sources: Vec<SourceNapi>,
}

#[napi(object)]
pub struct StatementWarning {
    pub kind: String,
    pub message: String,
    pub account: String,
    #[napi(js_name = "sourceFile")]
    pub source_file: String,
    #[napi(js_name = "textContains")]
    pub text_contains: Vec<String>,
}

#[napi(object, use_nullable = true)]
pub struct ProcessUploadInput {
    #[napi(js_name = "accountId")]
    pub account_id: String,
    pub format: String,
    #[napi(js_name = "statementDate")]
    pub statement_date: Option<String>,
}

#[napi(object)]
pub struct ProcessResult {
    pub ok: bool,
    pub reason: Option<String>,
    pub warnings: Vec<StatementWarning>,
    pub logs: Option<String>,
}

#[napi(object)]
pub struct Bank {
    pub key: String,
    pub bank: String,
    pub variant: Option<String>,
    #[napi(js_name = "accountType")]
    pub account_type: String,
}

#[napi]
#[derive(Clone, Copy)]
pub enum StatementKind {
    Monthly,
    Annual,
}

#[napi(object)]
pub struct Statement {
    #[napi(js_name = "accountId")]
    pub account_id: String,
    pub kind: StatementKind,
    pub period: String,
    #[napi(js_name = "statementDate")]
    pub statement_date: String,
    pub formats: Vec<String>,
    #[napi(js_name = "periodStart")]
    pub period_start: Option<String>,
    #[napi(js_name = "periodEnd")]
    pub period_end: Option<String>,
}

#[napi(object)]
pub struct CoverageSegment {
    pub start: String,
    pub end: String,
    pub approximate: Option<bool>,
}

#[napi(object)]
pub struct CoverageGap {
    pub start: String,
    pub end: String,
    #[napi(js_name = "balancesMatch")]
    pub balances_match: Option<bool>,
}

#[napi(object)]
pub struct StatementCoverage {
    pub start: Option<String>,
    pub end: Option<String>,
    pub segments: Vec<CoverageSegment>,
    pub gaps: Vec<CoverageGap>,
    pub months: Vec<String>,
    #[napi(js_name = "periodCount")]
    pub period_count: u32,
}

#[napi(object)]
pub struct BalanceGap {
    pub month: String,
    pub status: String,
}

#[napi(object)]
pub struct StatementList {
    pub available: bool,
    #[napi(js_name = "statementCount")]
    pub statement_count: u32,
    pub starting: Option<String>,
    pub ending: Option<String>,
    pub formats: Vec<String>,
    pub coverage: StatementCoverage,
    pub statements: Vec<Statement>,
    #[napi(js_name = "balanceGaps")]
    pub balance_gaps: Vec<BalanceGap>,
}

#[napi(object)]
pub struct TransactionRow {
    pub date: String,
    pub description: String,
    #[napi(js_name = "refNo")]
    pub ref_no: String,
    pub credited: String,
    pub debited: String,
    #[napi(js_name = "sourceFile")]
    pub source_file: String,
}

#[napi(object)]
pub struct AccountTransactions {
    pub period: String,
    #[napi(js_name = "isAnnual")]
    pub is_annual: bool,
    pub rows: Vec<TransactionRow>,
}

#[napi(object, use_nullable = true)]
pub struct WriteUploadInput {
    #[napi(js_name = "userId")]
    pub user_id: String,
    #[napi(js_name = "dataKey", ts_type = "Buffer | null")]
    pub data_key: Option<::napi::bindgen_prelude::Buffer>,
    #[napi(js_name = "accountType")]
    pub account_type: String,
    #[napi(js_name = "accountId")]
    pub account_id: String,
    pub format: String,
    #[napi(js_name = "statementDate")]
    pub statement_date: Option<String>,
    pub filename: String,
    pub data: ::napi::bindgen_prelude::Buffer,
    pub passwords: Vec<String>,
}

#[napi(object)]
pub struct WriteUploadResult {
    pub relative: String,
}

#[napi(object, use_nullable = true)]
pub struct StatementFileInput {
    #[napi(js_name = "userId")]
    pub user_id: String,
    #[napi(js_name = "dataKey", ts_type = "Buffer | null")]
    pub data_key: Option<::napi::bindgen_prelude::Buffer>,
    #[napi(js_name = "accountType")]
    pub account_type: String,
    #[napi(js_name = "accountId")]
    pub account_id: String,
    pub format: String,
    #[napi(js_name = "statementDate")]
    pub statement_date: Option<String>,
    pub filename: Option<String>,
}

#[napi(object, use_nullable = true)]
pub struct ReadAccountStatementsInput {
    #[napi(js_name = "userId")]
    pub user_id: String,
    #[napi(js_name = "dataKey", ts_type = "Buffer | null")]
    pub data_key: Option<::napi::bindgen_prelude::Buffer>,
    pub account: Account,
}

#[napi(object, use_nullable = true)]
pub struct ReadAccountTransactionsInput {
    #[napi(js_name = "userId")]
    pub user_id: String,
    #[napi(js_name = "dataKey", ts_type = "Buffer | null")]
    pub data_key: Option<::napi::bindgen_prelude::Buffer>,
    pub account: Account,
}
