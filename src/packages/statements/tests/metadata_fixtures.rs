//! Golden tests for bank statement fixtures under `tests/fixtures/`.
//! Port of NetworthCSV `tests/test_metadata_fixtures.py`.

use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use chrono::{Datelike, NaiveDate};
use serde_json::Value;
use statements::approx_start_from_end;
use statements::banks::handlers::get_handler;
use statements::banks::helpers::balances_match;
use statements::banks::period::resolve_period_key_with_source;
use statements::domain::Account;

const REQUIRED_MANIFEST_KEYS: [&str; 3] = ["statement_month", "opening", "closing"];
const DUMMY_FILENAME: &str = "dummy__2099-99-99.pdf";

fn fixtures_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures")
}

fn manifest_path() -> PathBuf {
    fixtures_root().join("manifest.json")
}

fn load_manifest() -> Value {
    let raw = fs::read_to_string(manifest_path()).expect("read manifest");
    serde_json::from_str(&raw).expect("parse manifest")
}

fn list_fixture_paths() -> Vec<String> {
    let root = fixtures_root();
    let mut paths = Vec::new();
    collect_fixture_paths(&root, &root, &mut paths);
    paths.sort();
    paths
}

fn collect_fixture_paths(root: &Path, dir: &Path, paths: &mut Vec<String>) {
    for entry in fs::read_dir(dir).expect("read fixtures dir") {
        let path = entry.expect("dir entry").path();
        if path.is_dir() {
            collect_fixture_paths(root, &path, paths);
            continue;
        }
        if path.extension().and_then(|e| e.to_str()) != Some("txt") {
            continue;
        }
        let rel = path.strip_prefix(root).expect("strip prefix");
        let rel = rel.to_string_lossy().replace('\\', "/");
        let parts: Vec<&str> = rel.split('/').collect();
        if parts.len() < 3 {
            continue;
        }
        paths.push(rel);
    }
}

fn sample_account(bank: &str, variant: &str) -> Account {
    Account {
        id: "fixture-account".to_string(),
        user_id: "user-1".to_string(),
        bank: bank.to_string(),
        variant: if variant == "default" {
            None
        } else {
            Some(variant.to_string())
        },
        label: bank.to_string(),
        account_type: "credit_card".to_string(),
        opening_date: "2020-01-01".to_string(),
        closing_date: None,
        account_number: String::new(),
        passwords: vec!["x".to_string()],
        mail: None,
        statement: None,
        created_at: String::new(),
        updated_at: String::new(),
    }
}

fn bank_variant_from_path(path: &str) -> (&str, &str) {
    let parts: Vec<&str> = path.split('/').collect();
    let bank = parts[0];
    let variant = if parts.len() >= 3 && parts[1] != "default" {
        parts[1]
    } else {
        "default"
    };
    (bank, variant)
}

fn format_account_date(date: NaiveDate) -> String {
    format!("{:02}-{:02}-{:04}", date.day(), date.month(), date.year())
}

fn resolve_period_bounds(text: &str, account: &Account) -> (Option<String>, Option<String>) {
    let handler = get_handler(&account.bank, account.variant.as_deref()).expect("handler");
    let (mut start, mut end) = handler.get_statement_period(text);
    if start.is_some() && end.is_some() {
        if let (Some(s), Some(e)) = (start, end) {
            if s > e {
                start = Some(e);
                end = Some(s);
            }
        }
        return (start.map(format_account_date), end.map(format_account_date));
    }
    if end.is_none() {
        return (None, None);
    }
    let end_date = end.unwrap();
    let approx_start = approx_start_from_end(end_date);
    (
        Some(format_account_date(approx_start)),
        Some(format_account_date(end_date)),
    )
}

#[test]
fn manifest_file_exists() {
    assert!(
        manifest_path().is_file(),
        "missing manifest: {}",
        manifest_path().display()
    );
}

#[test]
fn every_fixture_file_listed_in_manifest() {
    let manifest = load_manifest();
    let manifest_keys: HashSet<&str> = manifest
        .as_object()
        .expect("manifest object")
        .keys()
        .map(String::as_str)
        .collect();
    let fixture_paths = list_fixture_paths();
    assert!(!fixture_paths.is_empty(), "no fixture paths discovered");
    let missing: Vec<&str> = fixture_paths
        .iter()
        .filter(|path| !manifest_keys.contains(path.as_str()))
        .map(String::as_str)
        .collect();
    assert_eq!(missing, &[] as &[&str]);
}

#[test]
fn every_manifest_entry_has_fixture_file() {
    let manifest = load_manifest();
    let fixture_paths: HashSet<String> = list_fixture_paths().into_iter().collect();
    let missing_files: Vec<&str> = manifest
        .as_object()
        .expect("manifest object")
        .keys()
        .filter(|rel| !fixture_paths.contains(rel.as_str()))
        .map(String::as_str)
        .collect();
    assert_eq!(missing_files, &[] as &[&str]);
}

#[test]
fn manifest_entries_have_required_keys() {
    for (rel, entry) in load_manifest().as_object().expect("manifest object") {
        let obj = entry.as_object().expect("entry object");
        for key in REQUIRED_MANIFEST_KEYS {
            assert!(obj.contains_key(key), "{}: missing '{}'", rel, key);
        }
    }
}

#[test]
fn all_fixtures_match_manifest() {
    if !fixtures_root().is_dir() {
        return;
    }

    let manifest = load_manifest();
    let mut failures: Vec<String> = Vec::new();

    for (rel, expected) in manifest.as_object().expect("manifest object") {
        let parts: Vec<&str> = rel.split('/').collect();
        if parts.len() < 3 {
            continue;
        }

        let sample_path = fixtures_root().join(rel);
        if !sample_path.is_file() {
            failures.push(format!("{}: fixture file missing", rel));
            continue;
        }

        let (bank, variant) = bank_variant_from_path(rel);
        let text = fs::read_to_string(&sample_path).expect("read fixture");
        let account = sample_account(bank, variant);
        let handler = get_handler(bank, Some(variant)).expect("handler");
        let obj = expected.as_object().expect("entry object");

        if let Some(expected_month) = obj.get("statement_month").and_then(|v| v.as_str()) {
            let (actual_month, _) =
                resolve_period_key_with_source(&text, DUMMY_FILENAME, &account).expect("period");
            if actual_month != expected_month {
                failures.push(format!(
                    "{}: month expected {:?}, got {:?}",
                    rel, expected_month, actual_month
                ));
            }
        }

        let opening = handler.get_opening_balance(&text);
        let closing = handler.get_closing_balance(&text);

        match obj.get("opening") {
            Some(Value::String(expected_opening)) => {
                if opening.is_none()
                    || !balances_match(opening.as_deref().unwrap(), expected_opening, None)
                {
                    failures.push(format!(
                        "{}: opening expected {:?}, got {:?}",
                        rel, expected_opening, opening
                    ));
                }
            }
            Some(Value::Null) if opening.is_some() => {
                failures.push(format!("{}: expected no opening, got {:?}", rel, opening));
            }
            _ => {}
        }

        match obj.get("closing") {
            Some(Value::String(expected_closing)) => {
                if closing.is_none()
                    || !balances_match(closing.as_deref().unwrap(), expected_closing, None)
                {
                    failures.push(format!(
                        "{}: closing expected {:?}, got {:?}",
                        rel, expected_closing, closing
                    ));
                }
            }
            Some(Value::Null) if closing.is_some() => {
                failures.push(format!("{}: expected no closing, got {:?}", rel, closing));
            }
            _ => {}
        }

        if let (Some(expected_start), Some(expected_end)) = (
            obj.get("period_start").and_then(|v| v.as_str()),
            obj.get("period_end").and_then(|v| v.as_str()),
        ) {
            let (period_start, period_end) = resolve_period_bounds(&text, &account);
            if period_start.as_deref() != Some(expected_start) {
                failures.push(format!(
                    "{}: period_start expected {:?}, got {:?}",
                    rel, expected_start, period_start
                ));
            }
            if period_end.as_deref() != Some(expected_end) {
                failures.push(format!(
                    "{}: period_end expected {:?}, got {:?}",
                    rel, expected_end, period_end
                ));
            }
        }
    }

    assert_eq!(failures, Vec::<String>::new());
}
