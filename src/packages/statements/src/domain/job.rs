use serde::{Deserialize, Serialize};

use super::account::Account;
use super::source::SourceNapi;

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct JobScope {
    pub account_id: Option<String>,
    pub financial_year: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct StatementsRun {
    pub user_id: String,
    pub scope: JobScope,
    pub accounts: Vec<Account>,
    pub sources: Vec<SourceNapi>,
}
