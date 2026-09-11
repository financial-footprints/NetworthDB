//! Pipeline and library errors (NetworthCSV `errors` port).

use thiserror::Error;

#[derive(Debug, Error)]
#[error("{message}")]
pub struct StageError {
    pub message: String,
}

impl StageError {
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
        }
    }
}

#[derive(Debug, Error)]
#[error("cancelled by user")]
pub struct JobCancelledError;

impl From<JobCancelledError> for StageError {
    fn from(_: JobCancelledError) -> Self {
        StageError::new("cancelled by user")
    }
}

#[cfg(test)]
mod test_errors;
