mod console;
mod tee;

use std::sync::{Arc, Mutex};

use crate::{LogDestination, LogError, LogLevel};

pub(crate) enum Backend {
    Console(console::Console),
    Tee(tee::Tee),
}

impl Backend {
    pub(crate) fn write(&self, level: LogLevel, line: &str) -> Result<(), LogError> {
        match self {
            Self::Console(console) => console.write(level, line),
            Self::Tee(tee) => tee.write(level, line),
        }
    }

    pub(crate) fn console(&self) -> console::Console {
        match self {
            Self::Console(console) => *console,
            Self::Tee(tee) => tee.console,
        }
    }
}

pub(crate) fn tee_backend(console: console::Console) -> (Backend, Arc<Mutex<Vec<String>>>) {
    let buffer = Arc::new(Mutex::new(Vec::new()));
    let backend = Backend::Tee(tee::Tee {
        console,
        buffer: buffer.clone(),
    });
    (backend, buffer)
}

impl From<LogDestination> for Backend {
    fn from(destination: LogDestination) -> Self {
        match destination {
            LogDestination::Console => Self::Console(console::Console(None)),
            LogDestination::Stdout => {
                Self::Console(console::Console(Some(console::Stream::Stdout)))
            }
            LogDestination::Stderr => {
                Self::Console(console::Console(Some(console::Stream::Stderr)))
            }
        }
    }
}
