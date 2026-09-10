//! NAPI boundary — exports are called from Bun/JavaScript, not from Rust.

#![allow(dead_code)]

use std::collections::HashMap;

use napi::bindgen_prelude::*;
use napi_derive::napi;
use serde_json::Value;

use crate::ray;
use crate::{InstallOptions, LogDestination, LogLevel, Logger};

type LogContext = HashMap<String, Value>;

#[napi(object)]
pub struct CreateLoggerOptions {
    pub level: LogLevel,
    pub app: String,
    pub destination: Option<LogDestination>,
    #[napi(ts_type = "LogContext")]
    pub default_context: Option<LogContext>,
}

#[napi(js_name = "Logger")]
pub struct LoggerHandle {
    default_context: LogContext,
}

#[napi]
impl LoggerHandle {
    #[napi]
    pub fn debug(
        &self,
        msg: String,
        #[napi(ts_arg_type = "LogContext")] context: Option<LogContext>,
    ) -> Result<()> {
        self.write(LogLevel::Debug, &msg, context)
    }

    #[napi]
    pub fn info(
        &self,
        msg: String,
        #[napi(ts_arg_type = "LogContext")] context: Option<LogContext>,
    ) -> Result<()> {
        self.write(LogLevel::Info, &msg, context)
    }

    #[napi]
    pub fn warn(
        &self,
        msg: String,
        #[napi(ts_arg_type = "LogContext")] context: Option<LogContext>,
    ) -> Result<()> {
        self.write(LogLevel::Warn, &msg, context)
    }

    #[napi]
    pub fn error(
        &self,
        msg: String,
        #[napi(ts_arg_type = "LogContext")] context: Option<LogContext>,
    ) -> Result<()> {
        self.write(LogLevel::Error, &msg, context)
    }

    #[napi]
    pub fn child(&self, #[napi(ts_arg_type = "LogContext")] context: LogContext) -> Self {
        Self {
            default_context: merge_context_maps(&self.default_context, Some(context)),
        }
    }
}

impl LoggerHandle {
    fn write(&self, level: LogLevel, msg: &str, context: Option<LogContext>) -> Result<()> {
        let merged = merge_context_maps(&self.default_context, context);
        let merged = if merged.is_empty() {
            None
        } else {
            Some(merged)
        };

        crate::log(level, msg, None, merged)
            .map_err(|err| Error::new(Status::GenericFailure, err.to_string()))
    }
}

#[napi(js_name = "createLogger")]
pub fn create_logger(options: CreateLoggerOptions) -> Result<LoggerHandle> {
    let destination = options.destination.unwrap_or(LogDestination::Stdout);

    Logger::install(InstallOptions {
        app: options.app,
        level: options.level,
        destination,
        process_ray_id: None,
    })
    .map_err(|err| Error::new(Status::InvalidArg, err.to_string()))?;

    Ok(LoggerHandle {
        default_context: options.default_context.unwrap_or_default(),
    })
}

#[napi(object)]
pub struct RayContext {
    #[napi(js_name = "rayId")]
    pub ray_id: Option<String>,
    #[napi(js_name = "actorId")]
    pub actor_id: Option<String>,
}

#[napi(js_name = "RayManager")]
pub struct RayHandle;

#[napi]
impl RayHandle {
    #[napi(constructor)]
    pub fn new() -> Self {
        Self
    }

    #[napi(js_name = "setActor")]
    pub fn set_actor(&self, actor_id: String) {
        ray::set_actor_id(actor_id);
    }

    #[napi(js_name = "current")]
    pub fn current(&self) -> RayContext {
        match ray::current() {
            Some(context) => RayContext {
                ray_id: Some(context.ray_id),
                actor_id: context.actor_id,
            },
            None => RayContext {
                ray_id: None,
                actor_id: None,
            },
        }
    }

    #[napi(js_name = "require")]
    pub fn require_ray_id(&self) -> Result<String> {
        ray::require_ray_id().map_err(|message| Error::new(Status::GenericFailure, message))
    }
}

fn merge_context_maps(base: &LogContext, overlay: Option<LogContext>) -> LogContext {
    let mut merged = base.clone();

    if let Some(overlay) = overlay {
        for (key, value) in overlay {
            if value.is_null() {
                continue;
            }

            merged.insert(key, value);
        }
    }

    merged
}
