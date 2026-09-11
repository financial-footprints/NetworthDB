#![allow(dead_code)]

use ::napi::bindgen_prelude::*;
use logger::with_tee_capture;
use napi::bindgen_prelude::Function;
use napi_derive::napi;

use crate::domain::convert::{banks_from_handlers, statement_list_from_stored};
use crate::domain::ProcessResult as DomainProcessResult;
use crate::pipeline::metadata::read_stored_metadata;
use crate::pipeline::{
    delete_account_statements as run_delete, process_pipeline as run_pipeline,
    process_upload as run_upload, read_account_transactions as run_read_transactions,
};
use crate::run::RunInput;

use super::convert::{
    account_from_wire, account_transactions_to_wire, bank_to_wire, process_result_to_wire,
    statement_list_to_wire, statements_run_from_wire,
};
use super::runtime::{data_key_buffer, file_store_for_user};
use super::types::{
    ProcessResult, ProcessUploadInput, ReadAccountStatementsInput, ReadAccountTransactionsInput,
    StatementsRun,
};

fn run_context_from_cancel(
    env: Env,
    should_cancel: Option<Function<(), bool>>,
    debug_trace: bool,
) -> crate::pipeline::context::RunContext {
    let cancel_ref = should_cancel.and_then(|callback| callback.create_ref().ok());
    match (cancel_ref, debug_trace) {
        (None, false) => crate::pipeline::context::RunContext::new(),
        (None, true) => crate::pipeline::context::RunContext::with_trace(),
        (Some(cancel_ref), false) => {
            crate::pipeline::context::RunContext::with_cancel(Box::new(move || {
                cancel_ref
                    .borrow_back(&env)
                    .and_then(|callback| callback.call(()))
                    .unwrap_or(false)
            }))
        }
        (Some(cancel_ref), true) => {
            crate::pipeline::context::RunContext::with_cancel_and_trace(Box::new(move || {
                cancel_ref
                    .borrow_back(&env)
                    .and_then(|callback| callback.call(()))
                    .unwrap_or(false)
            }))
        }
    }
}

fn run_with_optional_capture<F>(debug_trace: bool, run: F) -> Result<DomainProcessResult>
where
    F: FnOnce() -> DomainProcessResult,
{
    if debug_trace {
        let (result, logs) = with_tee_capture(run)
            .map_err(|err| Error::new(Status::GenericFailure, err.to_string()))?;
        Ok(DomainProcessResult {
            ok: result.ok,
            reason: result.reason,
            warnings: result.warnings,
            logs: Some(logs),
        })
    } else {
        Ok(run())
    }
}

fn build_run_input(run: StatementsRun, data_key: Option<Vec<u8>>) -> Result<RunInput> {
    let domain_run = statements_run_from_wire(run);
    RunInput::from_parts(
        domain_run.user_id,
        data_key,
        domain_run.scope,
        domain_run.accounts,
        domain_run.sources,
    )
    .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))
}

#[napi(js_name = "listBanks")]
pub fn list_banks() -> Vec<super::types::Bank> {
    banks_from_handlers()
        .into_iter()
        .map(bank_to_wire)
        .collect()
}

#[napi(js_name = "processPipeline")]
pub fn process_pipeline(
    env: Env,
    run: StatementsRun,
    data_key: Option<Buffer>,
    debug_trace: Option<bool>,
    #[napi(ts_arg_type = "() => boolean")] should_cancel: Option<Function<(), bool>>,
) -> Result<ProcessResult> {
    let ctx = build_run_input(run, data_key_buffer(data_key))?;
    let debug = debug_trace.unwrap_or(false);
    let run_ctx = run_context_from_cancel(env, should_cancel, debug);
    let result = run_with_optional_capture(debug, || run_pipeline(&ctx, &run_ctx))?;
    Ok(process_result_to_wire(result))
}

#[napi(js_name = "processUpload")]
pub fn process_upload(
    env: Env,
    run: StatementsRun,
    upload: ProcessUploadInput,
    data_key: Option<Buffer>,
    debug_trace: Option<bool>,
    #[napi(ts_arg_type = "() => boolean")] should_cancel: Option<Function<(), bool>>,
) -> Result<ProcessResult> {
    let ctx = build_run_input(run, data_key_buffer(data_key))?;
    let debug = debug_trace.unwrap_or(false);
    let run_ctx = run_context_from_cancel(env, should_cancel, debug);
    let result = run_with_optional_capture(debug, || {
        run_upload(
            &ctx,
            &run_ctx,
            &upload.account_id,
            &upload.format,
            upload.statement_date.as_deref(),
        )
    })?;
    Ok(process_result_to_wire(result))
}

#[napi(js_name = "readAccountStatements")]
pub fn read_account_statements(
    input: ReadAccountStatementsInput,
) -> Result<super::types::StatementList> {
    let account = account_from_wire(input.account);
    let config = file_store_for_user(&input.user_id, data_key_buffer(input.data_key))?;
    let stored = read_stored_metadata(&config, &account);
    Ok(statement_list_to_wire(statement_list_from_stored(
        stored,
        &account.id,
    )))
}

#[napi(js_name = "readAccountTransactions")]
pub fn read_account_transactions(
    input: ReadAccountTransactionsInput,
) -> Result<Vec<super::types::AccountTransactions>> {
    let account = account_from_wire(input.account);
    let ctx = RunInput::from_parts(
        input.user_id.clone(),
        data_key_buffer(input.data_key),
        crate::domain::JobScope {
            account_id: Some(account.id.clone()),
            financial_year: None,
        },
        vec![account.clone()],
        vec![],
    )
    .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))?;
    run_read_transactions(&ctx, &account)
        .map(account_transactions_to_wire)
        .map_err(|err| Error::new(Status::GenericFailure, err.to_string()))
}

#[napi(js_name = "deleteAccountStatements")]
pub fn delete_account_statements(
    run: StatementsRun,
    account_id: String,
    data_key: Option<Buffer>,
) -> Result<ProcessResult> {
    let ctx = build_run_input(run, data_key_buffer(data_key))?;
    Ok(process_result_to_wire(run_delete(&ctx, &account_id)))
}
