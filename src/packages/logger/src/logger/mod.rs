use std::collections::HashMap;
use std::str::FromStr;
use std::sync::Mutex;

use chrono::Utc;
use napi_derive::napi;
use serde_json::{Map, Value};
use uuid::Uuid;

use crate::backend::Backend;
use crate::ray;

#[napi(string_enum = "lowercase")]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LogLevel {
    Debug,
    Info,
    Warn,
    Error,
}

impl LogLevel {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Debug => "debug",
            Self::Info => "info",
            Self::Warn => "warn",
            Self::Error => "error",
        }
    }
}

impl FromStr for LogLevel {
    type Err = String;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "debug" => Ok(Self::Debug),
            "info" => Ok(Self::Info),
            "warn" => Ok(Self::Warn),
            "error" => Ok(Self::Error),
            other => Err(format!("invalid log level: {other}")),
        }
    }
}

fn level_priority(level: LogLevel) -> u8 {
    match level {
        LogLevel::Debug => 0,
        LogLevel::Info => 1,
        LogLevel::Warn => 2,
        LogLevel::Error => 3,
    }
}

pub struct InstallOptions {
    pub app: String,
    pub level: LogLevel,
    pub destination: LogDestination,
    pub process_ray_id: Option<String>,
}

impl InstallOptions {
    pub fn new(app: impl Into<String>) -> Self {
        Self {
            app: app.into(),
            level: log_level_from_env(),
            destination: LogDestination::Console,
            process_ray_id: Some(Uuid::new_v4().to_string()),
        }
    }
}

#[napi(string_enum = "lowercase")]
pub enum LogDestination {
    Console,
    Stdout,
    Stderr,
}

impl LogDestination {
    pub fn parse(raw: &str) -> Result<Self, LogError> {
        match raw {
            "console" => Ok(Self::Console),
            "stdout" => Ok(Self::Stdout),
            "stderr" => Ok(Self::Stderr),
            other => Err(LogError::InvalidDestination(other.to_string())),
        }
    }
}

fn log_level_from_env() -> LogLevel {
    match std::env::var("LOG_LEVEL") {
        Ok(value) => LogLevel::from_str(&value).unwrap_or(LogLevel::Info),
        Err(_) => LogLevel::Info,
    }
}

#[derive(Clone, Copy, Debug)]
pub struct Logger;

impl Logger {
    pub fn install(options: InstallOptions) -> Result<Self, LogError> {
        let mut default_context = HashMap::new();
        default_context.insert("app".to_string(), Value::String(options.app));
        default_context.insert(
            "service".to_string(),
            Value::String("networthdb".to_string()),
        );

        *LOGGER.lock().map_err(|_| LogError::LockPoisoned)? = Some(LoggerState {
            min_level: options.level,
            default_context,
            backend: options.destination.into(),
            process_ray_id: options.process_ray_id,
        });

        Ok(Self)
    }

    pub fn debug(&self, msg: &str, context: Option<HashMap<String, Value>>) {
        let _ = write_log(LogLevel::Debug, msg, None, context);
    }

    pub fn info(&self, msg: &str, context: Option<HashMap<String, Value>>) {
        let _ = write_log(LogLevel::Info, msg, None, context);
    }

    pub fn warn(&self, msg: &str, context: Option<HashMap<String, Value>>) {
        let _ = write_log(LogLevel::Warn, msg, None, context);
    }

    pub fn error(&self, msg: &str, context: Option<HashMap<String, Value>>) {
        let _ = write_log(LogLevel::Error, msg, None, context);
    }
}

struct LoggerState {
    min_level: LogLevel,
    default_context: HashMap<String, Value>,
    backend: Backend,
    process_ray_id: Option<String>,
}

static LOGGER: Mutex<Option<LoggerState>> = Mutex::new(None);

fn validate_message(message: &str) -> Result<(), LogError> {
    if message.trim().is_empty() {
        return Err(LogError::EmptyMessage);
    }

    Ok(())
}

fn write_log(
    level: LogLevel,
    msg: &str,
    ray_id: Option<&str>,
    context: Option<HashMap<String, Value>>,
) -> Result<(), LogError> {
    validate_message(msg)?;

    let mut logger_guard = LOGGER.lock().map_err(|_| LogError::LockPoisoned)?;
    let logger = logger_guard.as_mut().ok_or(LogError::NotInitialized)?;

    if level_priority(level) < level_priority(logger.min_level) {
        return Ok(());
    }

    let mut entry = Map::new();
    entry.insert(
        "time".to_string(),
        Value::String(Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)),
    );
    entry.insert(
        "level".to_string(),
        Value::String(level.as_str().to_string()),
    );
    entry.insert("msg".to_string(), Value::String(msg.to_string()));

    for (key, value) in &logger.default_context {
        entry.insert(key.clone(), value.clone());
    }

    let resolved_ray_id = ray_id
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
        .or_else(ray::current_ray_id)
        .or_else(|| logger.process_ray_id.clone());

    if let Some(ray_id) = resolved_ray_id {
        entry.insert("rayId".to_string(), Value::String(ray_id));
    }

    if let Some(active_ray) = ray::current() {
        if let Some(actor_id) = active_ray.actor_id {
            entry.insert("actorId".to_string(), Value::String(actor_id));
        }
    }

    if let Some(context) = context {
        for (key, value) in context {
            entry.insert(key, value);
        }
    }

    let line = serde_json::to_string(&Value::Object(entry)).map_err(LogError::Serialize)?;

    logger.backend.write(level, &line)?;

    Ok(())
}

pub fn log(
    level: LogLevel,
    msg: &str,
    ray_id: Option<&str>,
    context: Option<HashMap<String, Value>>,
) -> Result<(), LogError> {
    write_log(level, msg, ray_id, context)
}

pub async fn scope<F, T>(ray_id: &str, future: F) -> T
where
    F: std::future::Future<Output = T>,
{
    ray::scope(ray_id, future).await
}

pub fn current_ray_id() -> Option<String> {
    ray::current_ray_id().or_else(|| {
        LOGGER.lock().ok().and_then(|state| {
            state
                .as_ref()
                .and_then(|logger| logger.process_ray_id.clone())
        })
    })
}

#[derive(Debug, thiserror::Error)]
pub enum LogError {
    #[error("logger.not-initialized")]
    NotInitialized,
    #[error("logger.lock-poisoned")]
    LockPoisoned,
    #[error("logger.message.empty")]
    EmptyMessage,
    #[error("logger.serialize.failed.{0}")]
    Serialize(serde_json::Error),
    #[error("logger.write.failed.{0}")]
    Write(std::io::Error),
    #[error("logger.destination.invalid.{0}")]
    InvalidDestination(String),
}

#[cfg(test)]
mod test_logger;
