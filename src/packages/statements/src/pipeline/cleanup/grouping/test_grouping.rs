use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use lopdf::content::{Content, Operation};
use lopdf::{dictionary, Document, Object, Stream};

use crate::domain::Account;
use crate::pipeline::alerts::{AlertKind, AlertService};

use super::collect_staging_groups;

fn unique_temp_dir(name: &str) -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("time")
        .as_nanos();
    std::env::temp_dir().join(format!("ndb-grouping-test-{}-{}", name, nanos))
}

fn sample_account() -> Account {
    Account {
        id: "acct-1".to_string(),
        user_id: "user-1".to_string(),
        bank: "test".to_string(),
        variant: None,
        label: "test".to_string(),
        account_type: "credit_card".to_string(),
        opening_date: "2020-01-01".to_string(),
        closing_date: None,
        account_number: String::new(),
        passwords: vec![],
        mail: None,
        statement: None,
        created_at: String::new(),
        updated_at: String::new(),
    }
}

fn build_sample_pdf_bytes() -> Vec<u8> {
    let mut doc = Document::with_version("1.5");
    let pages_id = doc.new_object_id();
    let font_id = doc.add_object(dictionary! {
        "Type" => "Font",
        "Subtype" => "Type1",
        "BaseFont" => "Courier",
    });
    let resources_id = doc.add_object(dictionary! {
        "Font" => dictionary! {
            "F1" => font_id,
        },
    });
    let content = Content {
        operations: vec![
            Operation::new("BT", vec![]),
            Operation::new("Tf", vec!["F1".into(), 12.into()]),
            Operation::new("Td", vec![100.into(), 600.into()]),
            Operation::new("Tj", vec![Object::string_literal("SAMPLE TEXT")]),
            Operation::new("ET", vec![]),
        ],
    };
    let content_id = doc.add_object(Stream::new(dictionary! {}, content.encode().unwrap()));
    let page_id = doc.add_object(dictionary! {
        "Type" => "Page",
        "Parent" => pages_id,
        "Contents" => content_id,
        "Resources" => resources_id,
        "MediaBox" => vec![0.into(), 0.into(), 200.into(), 200.into()],
    });
    let pages = dictionary! {
        "Type" => "Pages",
        "Kids" => vec![page_id.into()],
        "Count" => 1,
    };
    doc.objects.insert(pages_id, Object::Dictionary(pages));
    let catalog_id = doc.add_object(dictionary! {
        "Type" => "Catalog",
        "Pages" => pages_id,
    });
    doc.trailer.set("Root", catalog_id);

    let mut buffer = Vec::new();
    doc.save_to(&mut buffer).expect("save");
    buffer
}

#[test]
fn collect_staging_groups_skips_unopenable_pdf_and_emits_warning() {
    let staging_dir = unique_temp_dir("staging");
    fs::create_dir_all(&staging_dir).expect("mkdir");

    let good_path = staging_dir.join("manual__2024-01.pdf");
    fs::write(&good_path, build_sample_pdf_bytes()).expect("write good pdf");
    fs::write(staging_dir.join("corrupt.pdf"), b"not-a-pdf").expect("write bad pdf");

    let account = sample_account();
    let mut alerts = AlertService::new();
    let (pdf_groups, _csv_groups) =
        collect_staging_groups(&staging_dir, &account, None, None, &mut alerts)
            .expect("collect groups");

    assert_eq!(pdf_groups.raw_by_path.len(), 1);
    assert!(pdf_groups.raw_by_path.contains_key(&good_path));
    assert_eq!(
        pdf_groups.groups.get("2024-01").map(|paths| paths.len()),
        Some(1)
    );

    let pdf_alerts: Vec<_> = alerts
        .alerts()
        .iter()
        .filter(|alert| alert.kind == AlertKind::PdfOpenFailed)
        .collect();
    assert_eq!(pdf_alerts.len(), 1);
    assert_eq!(pdf_alerts[0].source_file, "corrupt.pdf");

    fs::remove_dir_all(&staging_dir).ok();
}
