//! Extract stage: IMAP / Thunderbird → staging attachments.

mod imap;
mod thunderbird;

use crate::domain::Source;

use crate::errors::StageError;
use crate::pipeline::context::{raise_if_cancelled, RunContext};
use crate::pipeline::results::ExtractStageResult;
use crate::run::RunInput;

pub fn run_all(ctx: &RunInput, run_ctx: &RunContext) -> Result<ExtractStageResult, StageError> {
    raise_if_cancelled(run_ctx)?;
    let accounts = ctx.accounts_to_run();
    if accounts.is_empty() {
        if run_ctx.trace_enabled() {
            run_ctx.trace_info("extract", "no accounts to run", None);
        }
        return Ok(ExtractStageResult { accounts: vec![] });
    }
    if ctx.sources.is_empty() {
        return Err(StageError::new("no statement sources configured"));
    }

    if run_ctx.trace_enabled() {
        run_ctx.trace_info(
            "extract",
            "extract stage started",
            Some(serde_json::json!({
                "accountCount": accounts.len(),
                "sourceCount": ctx.sources.len(),
            })),
        );
    }

    let mut results = Vec::new();
    for source in &ctx.sources {
        raise_if_cancelled(run_ctx)?;
        match source {
            Source::Thunderbird { .. } => {
                if run_ctx.trace_enabled() {
                    run_ctx.trace_info("extract", "running thunderbird extract", None);
                }
                for account in &accounts {
                    raise_if_cancelled(run_ctx)?;
                    results.push(thunderbird::run_account(ctx, run_ctx, account, source)?);
                }
            }
            Source::Email { .. } => {
                if run_ctx.trace_enabled() {
                    run_ctx.trace_info("extract", "running imap extract", None);
                }
                let group = imap::run_imap_extract(ctx, run_ctx, &accounts, source)?;
                results.extend(group);
            }
        }
    }
    Ok(ExtractStageResult { accounts: results })
}
