use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use lopdf::content::{Content, Operation};
use lopdf::{dictionary, Document, Object, Stream};

use super::{extract_pdf_text, write_text_pdf};

fn unique_temp_path(name: &str) -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("time")
        .as_nanos();
    std::env::temp_dir().join(format!("ndb-pdf-test-{}-{}", name, nanos))
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
fn extract_unencrypted_pdf_text() {
    let path = unique_temp_path("plain.pdf");
    fs::write(&path, build_sample_pdf_bytes()).expect("write");
    let text = extract_pdf_text(&path, &[]).expect("extract");
    fs::remove_file(&path).ok();
    assert!(text.contains("SAMPLE TEXT"));
}

#[test]
fn write_text_pdf_roundtrip() {
    let path = unique_temp_path("written.pdf");
    write_text_pdf(
        &path,
        "OneCard Statement (01 Aug 2021 - 31 Aug 2021)\nStatement Date\n01 Sep 2021",
    )
    .expect("write");
    let text = extract_pdf_text(&path, &[]).expect("extract");
    fs::remove_file(&path).ok();
    assert!(text.contains("OneCard Statement"));
    assert!(text.contains("Statement Date"));
}

#[test]
fn extract_missing_file_fails() {
    let path = unique_temp_path("missing.pdf");
    let result = extract_pdf_text(&path, &[]);
    assert!(result.is_err());
}

#[test]
fn classify_incorrect_password_error() {
    use super::{classify_pdf_open_detail, PdfOpenFailureKind};
    assert_eq!(
        classify_pdf_open_detail("the supplied password is incorrect"),
        PdfOpenFailureKind::IncorrectPassword
    );
}

#[test]
fn classify_unsupported_encryption_errors() {
    use super::{classify_pdf_open_detail, PdfOpenFailureKind};
    assert_eq!(
        classify_pdf_open_detail("unsupported key length"),
        PdfOpenFailureKind::UnsupportedEncryption
    );
    assert_eq!(
        classify_pdf_open_detail("invalid key length"),
        PdfOpenFailureKind::UnsupportedEncryption
    );
    assert_eq!(
        classify_pdf_open_detail(
            "the document uses an encryption scheme that is not implemented in lopdf"
        ),
        PdfOpenFailureKind::UnsupportedEncryption
    );
}

#[test]
fn pdf_open_failure_from_error_uses_trailing_detail() {
    use super::{pdf_open_failure_from_error, PdfError, PdfOpenFailureKind};
    let err = PdfError::new("could not open /tmp/bad.pdf: the supplied password is incorrect");
    let failure = pdf_open_failure_from_error(&err);
    assert_eq!(failure.kind, PdfOpenFailureKind::IncorrectPassword);
}
