//! Pipeline run context (NetworthCSV `RunContext` port).

use std::collections::HashMap;

use logger::{log, LogLevel};
use serde_json::Value;

use crate::errors::JobCancelledError;

pub struct RunContext {
    pub should_cancel: Option<Box<dyn Fn() -> bool>>,
    trace_enabled: bool,
}

impl RunContext {
    pub fn new() -> Self {
        Self {
            should_cancel: None,
            trace_enabled: false,
        }
    }

    pub fn with_cancel(should_cancel: Box<dyn Fn() -> bool>) -> Self {
        Self {
            should_cancel: Some(should_cancel),
            trace_enabled: false,
        }
    }

    pub fn with_trace() -> Self {
        Self {
            should_cancel: None,
            trace_enabled: true,
        }
    }

    pub fn with_cancel_and_trace(should_cancel: Box<dyn Fn() -> bool>) -> Self {
        Self {
            should_cancel: Some(should_cancel),
            trace_enabled: true,
        }
    }

    pub fn trace_enabled(&self) -> bool {
        self.trace_enabled
    }

    fn trace_log(&self, level: LogLevel, stage: &str, message: &str, context: Option<Value>) {
        if !self.trace_enabled {
            return;
        }

        let mut log_context = HashMap::new();
        log_context.insert("stage".to_string(), Value::String(stage.to_string()));
        if let Some(Value::Object(map)) = context {
            for (key, value) in map {
                log_context.insert(key, value);
            }
        }

        let _ = log(level, message, None, Some(log_context));
    }

    pub fn trace_info(&self, stage: &str, message: &str, context: Option<Value>) {
        self.trace_log(LogLevel::Info, stage, message, context);
    }

    pub fn trace_warn(&self, stage: &str, message: &str, context: Option<Value>) {
        self.trace_log(LogLevel::Warn, stage, message, context);
    }

    pub fn trace_error(&self, stage: &str, message: &str, context: Option<Value>) {
        self.trace_log(LogLevel::Error, stage, message, context);
    }
}

impl Default for RunContext {
    fn default() -> Self {
        Self::new()
    }
}

pub fn raise_if_cancelled(ctx: &RunContext) -> Result<(), JobCancelledError> {
    if ctx.should_cancel.as_ref().is_some_and(|check| check()) {
        return Err(JobCancelledError);
    }
    Ok(())
}

#[cfg(test)]
mod test_context;
