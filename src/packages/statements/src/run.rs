//! Pipeline run input assembled from domain types.

use crate::domain::convert::source_from_napi;
use crate::domain::{Account, JobScope, Source, SourceNapi};

use crate::errors::StageError;
use crate::vault::store::FileStoreConfig;

#[derive(Clone, Debug)]
pub struct RunInput {
    pub user_id: String,
    pub data_key: Option<Vec<u8>>,
    pub scope: JobScope,
    pub accounts: Vec<Account>,
    pub sources: Vec<Source>,
}

impl RunInput {
    pub fn from_parts(
        user_id: String,
        data_key: Option<Vec<u8>>,
        scope: JobScope,
        accounts: Vec<Account>,
        source_napi: Vec<SourceNapi>,
    ) -> Result<Self, StageError> {
        let sources = source_napi
            .into_iter()
            .map(source_from_napi)
            .collect::<Result<Vec<_>, _>>()
            .map_err(StageError::new)?;
        Ok(Self {
            user_id,
            data_key,
            scope,
            accounts,
            sources,
        })
    }

    pub fn file_store_config(&self) -> Result<FileStoreConfig, StageError> {
        let runtime =
            crate::vault::runtime::current().map_err(|e| StageError::new(e.to_string()))?;
        if runtime.encrypt_at_rest && self.data_key.is_none() {
            return Err(StageError::new("statements.store.invalid.key-required"));
        }
        Ok(FileStoreConfig {
            tenant_root: runtime.filestore_path.join(&self.user_id),
            encrypt_at_rest: runtime.encrypt_at_rest,
            data_key: self.data_key.clone(),
        })
    }

    pub fn accounts_to_run(&self) -> Vec<Account> {
        if let Some(account_id) = &self.scope.account_id {
            return self
                .accounts
                .iter()
                .filter(|account| account.id == *account_id)
                .cloned()
                .collect();
        }
        self.accounts.clone()
    }

    pub fn account_workspace(&self, account: &Account) -> std::path::PathBuf {
        crate::vault::workspace::account_workspace(
            &self.user_id,
            &account.account_type,
            &account.id,
        )
    }

    pub fn financial_year_filter(&self) -> Option<&str> {
        self.scope
            .financial_year
            .as_deref()
            .filter(|fy| !fy.is_empty())
    }
}
