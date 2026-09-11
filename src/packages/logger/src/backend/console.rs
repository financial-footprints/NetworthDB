use std::io::{self, Write};

use crate::{LogError, LogLevel};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Stream {
    Stdout,
    Stderr,
}

#[derive(Clone, Copy)]
pub(crate) struct Console(pub Option<Stream>);

impl Console {
    pub fn write(&self, level: LogLevel, line: &str) -> Result<(), LogError> {
        let stream = self.0.unwrap_or(match level {
            LogLevel::Debug | LogLevel::Info => Stream::Stdout,
            LogLevel::Warn | LogLevel::Error => Stream::Stderr,
        });

        match stream {
            Stream::Stdout => {
                let mut writer = io::stdout().lock();
                writeln!(writer, "{line}").map_err(LogError::Write)?;
                writer.flush().map_err(LogError::Write)?;
            }
            Stream::Stderr => {
                let mut writer = io::stderr().lock();
                writeln!(writer, "{line}").map_err(LogError::Write)?;
                writer.flush().map_err(LogError::Write)?;
            }
        }

        Ok(())
    }
}
