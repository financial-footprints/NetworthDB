//! Read-only IMAP client (NetworthCSV `readonly_imap.py` port).

use std::net::{TcpStream, ToSocketAddrs};
use std::time::Duration;

use imap::{Client, Session};

use crate::errors::StageError;

pub const IMAP_CONNECT_TIMEOUT: Duration = Duration::from_secs(30);
pub const IMAP_READ_TIMEOUT: Duration = Duration::from_secs(300);
pub const IMAP_WRITE_TIMEOUT: Duration = Duration::from_secs(300);
pub const IMAP_FETCH_MAX_ATTEMPTS: u32 = 3;

const FORBIDDEN: &[&str] = &[
    "STORE", "COPY", "APPEND", "EXPUNGE", "DELETE", "CREATE", "RENAME", "MOVE",
];

fn validate_command(name: &str) -> Result<(), StageError> {
    let upper = name.to_ascii_uppercase();
    for marker in FORBIDDEN {
        if upper.contains(marker) {
            return Err(StageError::new(format!(
                "read-only IMAP client refused command: {}",
                name
            )));
        }
    }
    Ok(())
}

pub fn quote_imap_string(value: &str) -> String {
    if value.starts_with('"') && value.ends_with('"') && value.len() >= 2 {
        return value.to_string();
    }
    let escaped = value.replace('\\', "\\\\").replace('"', "\\\"");
    format!("\"{}\"", escaped)
}

const IMAP_SEARCH_KEYWORDS: &[&str] = &[
    "ALL",
    "ANSWERED",
    "BCC",
    "BEFORE",
    "BODY",
    "CC",
    "DELETED",
    "DRAFT",
    "FLAGGED",
    "FROM",
    "HEADER",
    "KEYWORD",
    "LARGER",
    "NEW",
    "NOT",
    "OLD",
    "ON",
    "OR",
    "RECENT",
    "SEEN",
    "SENT",
    "SINCE",
    "SMALLER",
    "SUBJECT",
    "TEXT",
    "TO",
    "UID",
    "UNANSWERED",
    "UNDELETED",
    "UNDRAFT",
    "UNFLAGGED",
    "UNKEYWORD",
    "UNSEEN",
    "X-GM-RAW",
];

fn needs_imap_quoting(value: &str) -> bool {
    if value.starts_with('"') && value.ends_with('"') && value.len() >= 2 {
        return false;
    }
    if value.chars().any(|c| c.is_whitespace()) {
        return true;
    }
    !value
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
}

pub fn prepare_search_criteria(criteria: &[String]) -> Vec<String> {
    criteria
        .iter()
        .map(|item| {
            if IMAP_SEARCH_KEYWORDS
                .iter()
                .any(|kw| kw.eq_ignore_ascii_case(item))
            {
                item.clone()
            } else if needs_imap_quoting(item) {
                quote_imap_string(item)
            } else {
                item.clone()
            }
        })
        .collect()
}

/// Trim and default empty mailbox names to INBOX.
/// Quoting is left to the `imap` crate's `Session::examine`.
pub fn normalize_mailbox_name(mailbox: &str) -> String {
    let mailbox = mailbox.trim();
    if mailbox.is_empty() || mailbox.eq_ignore_ascii_case("INBOX") {
        return "INBOX".to_string();
    }
    mailbox.to_string()
}

#[derive(Debug, Clone)]
pub struct ConnectionConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub use_ssl: bool,
    pub folder: String,
}

pub struct ReadOnlyImapClient {
    session: Session<native_tls::TlsStream<TcpStream>>,
    commands: Vec<String>,
    connection: ConnectionConfig,
}

fn connect_session(
    config: &ConnectionConfig,
) -> Result<Session<native_tls::TlsStream<TcpStream>>, StageError> {
    if !config.use_ssl {
        return Err(StageError::new("non-SSL IMAP is not supported"));
    }

    let tls = native_tls::TlsConnector::builder()
        .build()
        .map_err(|e| StageError::new(e.to_string()))?;

    let addrs = (config.host.as_str(), config.port)
        .to_socket_addrs()
        .map_err(|e| StageError::new(format!("IMAP connect failed: {}", e)))?;

    let mut last_err: Option<std::io::Error> = None;
    let mut client: Option<Client<native_tls::TlsStream<TcpStream>>> = None;

    for addr in addrs {
        match TcpStream::connect_timeout(&addr, IMAP_CONNECT_TIMEOUT) {
            Ok(tcp) => {
                if let Err(e) = tcp.set_read_timeout(Some(IMAP_READ_TIMEOUT)) {
                    last_err = Some(e);
                    continue;
                }
                if let Err(e) = tcp.set_write_timeout(Some(IMAP_WRITE_TIMEOUT)) {
                    last_err = Some(e);
                    continue;
                }
                match native_tls::TlsConnector::connect(&tls, &config.host, tcp) {
                    Ok(tls_stream) => {
                        let mut imap_client = Client::new(tls_stream);
                        match imap_client.read_greeting() {
                            Ok(_) => {
                                client = Some(imap_client);
                                break;
                            }
                            Err(e) => {
                                last_err = Some(std::io::Error::new(
                                    std::io::ErrorKind::Other,
                                    e.to_string(),
                                ));
                            }
                        }
                    }
                    Err(e) => {
                        last_err = Some(std::io::Error::new(
                            std::io::ErrorKind::Other,
                            e.to_string(),
                        ));
                    }
                }
            }
            Err(e) => last_err = Some(e),
        }
    }

    let client = client.ok_or_else(|| {
        StageError::new(format!(
            "IMAP connect failed: {}",
            last_err
                .map(|e| e.to_string())
                .unwrap_or_else(|| "no addresses resolved".to_string())
        ))
    })?;

    client
        .login(&config.username, &config.password)
        .map_err(|(err, _)| StageError::new(format!("IMAP login failed: {}", err)))
}

impl ReadOnlyImapClient {
    pub fn connect(
        host: &str,
        port: u16,
        username: &str,
        password: &str,
        use_ssl: bool,
        folder: &str,
    ) -> Result<Self, StageError> {
        let connection = ConnectionConfig {
            host: host.to_string(),
            port,
            username: username.to_string(),
            password: password.to_string(),
            use_ssl,
            folder: normalize_mailbox_name(folder),
        };
        let session = connect_session(&connection)?;

        Ok(Self {
            session,
            commands: Vec::new(),
            connection,
        })
    }

    pub fn is_connection_lost(err: &StageError) -> bool {
        err.message.contains("Connection Lost")
    }

    pub fn reconnect(&mut self) -> Result<(), StageError> {
        let folder = self.connection.folder.clone();
        let _ = self.session.logout();
        self.commands.clear();
        self.session = connect_session(&self.connection)?;
        self.examine(&folder)
    }

    fn record(&mut self, name: &str) -> Result<(), StageError> {
        validate_command(name)?;
        self.commands.push(name.to_ascii_uppercase());
        Ok(())
    }

    pub fn examine(&mut self, mailbox: &str) -> Result<(), StageError> {
        self.record("EXAMINE")?;
        let mailbox = normalize_mailbox_name(mailbox);
        self.connection.folder = mailbox.clone();
        self.session.examine(&mailbox).map_err(|e| {
            StageError::new(format!("could not open IMAP folder {:?}: {}", mailbox, e))
        })?;
        Ok(())
    }

    pub fn search(
        &mut self,
        charset: Option<&str>,
        criteria: &[String],
    ) -> Result<Vec<String>, StageError> {
        self.record("SEARCH")?;
        let prepared = prepare_search_criteria(criteria);
        let refs: Vec<&str> = prepared.iter().map(String::as_str).collect();
        let uids = if let Some(charset) = charset {
            self.session
                .uid_search(format!("CHARSET {} {}", charset, refs.join(" ")))
                .map_err(|e| StageError::new(format!("IMAP search failed: {}", e)))?
        } else {
            self.session
                .uid_search(refs.join(" "))
                .map_err(|e| StageError::new(format!("IMAP search failed: {}", e)))?
        };
        Ok(uids.iter().map(|u| u.to_string()).collect())
    }

    pub fn uid_fetch_body_peek(&mut self, uid: &str) -> Result<Option<Vec<u8>>, StageError> {
        let parts = "(BODY.PEEK[])";
        if !parts.to_ascii_uppercase().contains("BODY.PEEK") {
            return Err(StageError::new(
                "read-only IMAP client only allows BODY.PEEK fetch",
            ));
        }
        self.record("UID FETCH")?;
        let fetches = self
            .session
            .uid_fetch(uid, parts)
            .map_err(|e| StageError::new(format!("IMAP fetch failed: {}", e)))?;
        for fetch in fetches.iter() {
            if let Some(body) = fetch.body() {
                return Ok(Some(body.to_vec()));
            }
        }
        Ok(None)
    }

    pub fn noop(&mut self) -> Result<(), StageError> {
        self.record("NOOP")?;
        self.session
            .noop()
            .map_err(|e| StageError::new(format!("IMAP NOOP failed: {}", e)))?;
        Ok(())
    }

    pub fn close(&mut self) -> Result<(), StageError> {
        self.record("CLOSE")?;
        let _ = self.session.close();
        Ok(())
    }

    pub fn logout(&mut self) -> Result<(), StageError> {
        self.record("LOGOUT")?;
        let _ = self.session.logout();
        Ok(())
    }
}

#[cfg(test)]
mod test_readonly_imap;
