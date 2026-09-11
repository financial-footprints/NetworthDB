use serde::{Deserialize, Serialize};

#[derive(Clone, Debug)]
pub enum Source {
    Thunderbird {
        id: String,
        label: String,
        profile: String,
    },
    Email {
        id: String,
        label: String,
        host: String,
        port: u32,
        username: String,
        password: Option<String>,
        folder: String,
        use_ssl: bool,
    },
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SourceNapi {
    pub id: String,
    pub r#type: String,
    pub label: String,
    pub profile: Option<String>,
    pub host: Option<String>,
    pub port: Option<u32>,
    pub username: Option<String>,
    pub password: Option<String>,
    pub folder: Option<String>,
    pub use_ssl: Option<bool>,
}

impl Source {
    pub fn id(&self) -> &str {
        match self {
            Source::Thunderbird { id, .. } | Source::Email { id, .. } => id,
        }
    }

    pub fn host(&self) -> Option<&str> {
        match self {
            Source::Email { host, .. } => Some(host),
            _ => None,
        }
    }

    pub fn port(&self) -> Option<u32> {
        match self {
            Source::Email { port, .. } => Some(*port),
            _ => None,
        }
    }

    pub fn username(&self) -> Option<&str> {
        match self {
            Source::Email { username, .. } => Some(username),
            _ => None,
        }
    }

    pub fn password(&self) -> Option<&str> {
        match self {
            Source::Email { password, .. } => password.as_deref(),
            _ => None,
        }
    }

    pub fn folder(&self) -> Option<&str> {
        match self {
            Source::Email { folder, .. } => Some(folder),
            Source::Thunderbird { .. } => None,
        }
    }

    pub fn use_ssl(&self) -> bool {
        match self {
            Source::Email { use_ssl, .. } => *use_ssl,
            _ => true,
        }
    }

    pub fn profile(&self) -> Option<&str> {
        match self {
            Source::Thunderbird { profile, .. } => Some(profile),
            _ => None,
        }
    }
}
