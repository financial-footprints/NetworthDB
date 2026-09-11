//! Thunderbird mbox file reader (minimal port of Python `mailbox.mbox`).

use std::fs;
use std::path::{Path, PathBuf};

use super::attachments::ParsedEmail;

const SKIP_DIR_NAMES: &[&str] = &["Feeds", "smart mailboxes"];

pub fn discover_mbox_files(profile: &Path) -> Vec<PathBuf> {
    let mut found = Vec::new();
    let imap_root = profile.join("ImapMail");
    if imap_root.is_dir() {
        collect_mbox_files(&imap_root, &mut found);
    }
    let local_root = profile.join("Mail").join("Local Folders");
    if local_root.is_dir() {
        collect_mbox_files(&local_root, &mut found);
    }
    found.sort();
    found.dedup();
    found
}

fn collect_mbox_files(dir: &Path, found: &mut Vec<PathBuf>) {
    let entries = fs::read_dir(dir).ok();
    for entry in entries.into_iter().flatten().flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect_mbox_files(&path, found);
        } else if is_mbox_store(&path) {
            found.push(path);
        }
    }
}

fn is_mbox_store(path: &Path) -> bool {
    if !path.is_file() {
        return false;
    }
    if path.extension().and_then(|e| e.to_str()) == Some("msf") {
        return false;
    }
    if path.file_name().and_then(|n| n.to_str()) == Some("msgFilterRules.dat") {
        return false;
    }
    let skip_exts = ["dat", "json", "html", "txt", "backup"];
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        if skip_exts.iter().any(|s| ext.eq_ignore_ascii_case(s)) {
            return false;
        }
    }
    for part in path.components() {
        if let Some(name) = part.as_os_str().to_str() {
            if SKIP_DIR_NAMES.contains(&name) {
                return false;
            }
        }
    }
    let msf = path.with_extension("msf");
    msf.is_file()
}

pub fn iter_mbox_messages(path: &Path) -> Vec<ParsedEmail> {
    let raw = fs::read_to_string(path).unwrap_or_default();
    if raw.is_empty() {
        return vec![];
    }
    let mut messages = Vec::new();
    let mut chunk = String::new();
    for line in raw.lines() {
        if line.starts_with("From ") && !chunk.is_empty() {
            if let Some(parsed) = ParsedEmail::parse(chunk.as_bytes()) {
                messages.push(parsed);
            }
            chunk.clear();
            continue;
        }
        if !chunk.is_empty() {
            chunk.push('\n');
        }
        chunk.push_str(line);
    }
    if !chunk.is_empty() {
        if let Some(parsed) = ParsedEmail::parse(chunk.as_bytes()) {
            messages.push(parsed);
        }
    }
    messages
}
