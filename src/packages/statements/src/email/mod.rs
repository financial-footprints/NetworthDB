//! IMAP and attachment helpers (NetworthCSV `utils/email` port).

mod attachments;
mod imap_search;
mod matching;
mod mbox;
mod message;
mod readonly_imap;

pub use attachments::ParsedEmail;
pub use imap_search::build_imap_search_criteria;
pub use matching::effective_mail_for_account;
pub use mbox::{discover_mbox_files, iter_mbox_messages};
pub use message::sanitize_filename;
pub use readonly_imap::{ReadOnlyImapClient, IMAP_FETCH_MAX_ATTEMPTS};

#[cfg(test)]
mod test_attachments;
#[cfg(test)]
mod test_imap_search;
