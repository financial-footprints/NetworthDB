#![allow(dead_code)]

use ::napi::bindgen_prelude::*;
use logger::{InstallOptions, LogDestination, LogLevel, Logger};
use napi_derive::napi;

use super::types::StatementsRuntimeConfig;

fn init_logger() {
    let _ = Logger::install(InstallOptions {
        app: "statements".to_string(),
        level: LogLevel::Info,
        destination: LogDestination::Console,
        process_ray_id: None,
    });
}

#[napi(js_name = "initStatementsRuntime")]
pub fn init_statements_runtime(config: Option<StatementsRuntimeConfig>) -> Result<()> {
    init_logger();

    match config {
        None => crate::vault::runtime::init_from_env().map_err(runtime_error),
        Some(cfg) => {
            let filestore_path = cfg.filestore_path.map(std::path::PathBuf::from);
            crate::vault::runtime::init_with(filestore_path, cfg.encrypt_at_rest)
                .map_err(runtime_error)
        }
    }
}

fn runtime_error(err: crate::vault::runtime::RuntimeError) -> Error {
    Error::new(Status::GenericFailure, err.to_string())
}

pub fn store_error(err: crate::vault::store::StoreError) -> Error {
    Error::new(Status::GenericFailure, err.to_string())
}

pub fn data_key_buffer(data_key: Option<Buffer>) -> Option<Vec<u8>> {
    data_key.map(|b| b.as_ref().to_vec())
}

pub fn file_store_for_user(
    user_id: &str,
    data_key: Option<Vec<u8>>,
) -> Result<crate::vault::store::FileStoreConfig> {
    crate::vault::runtime::file_store(user_id, data_key).map_err(store_error)
}
