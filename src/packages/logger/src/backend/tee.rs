use std::sync::{Arc, Mutex};

use super::console;
use crate::{LogError, LogLevel};

pub(crate) struct Tee {
    pub console: console::Console,
    pub buffer: Arc<Mutex<Vec<String>>>,
}

impl Tee {
    pub fn write(&self, level: LogLevel, line: &str) -> Result<(), LogError> {
        self.console.write(level, line)?;
        self.buffer
            .lock()
            .map_err(|_| LogError::LockPoisoned)?
            .push(line.to_string());
        Ok(())
    }
}
