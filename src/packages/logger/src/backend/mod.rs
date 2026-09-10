mod console;

use crate::{LogDestination, LogError, LogLevel};

pub(crate) enum Backend {
    Console(console::Console),
}

impl Backend {
    pub(crate) fn write(&self, level: LogLevel, line: &str) -> Result<(), LogError> {
        match self {
            Self::Console(console) => console.write(level, line),
        }
    }
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
