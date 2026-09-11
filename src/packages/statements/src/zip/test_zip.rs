use std::io::{Cursor, Write};

use zip::write::SimpleFileOptions;
use zip::{AesMode, CompressionMethod, ZipWriter};

use super::{
    extract_csvs_from_zip, extract_statements_from_zip, sanitize_zip_member_name, ZipNoCsvError,
    ZipNoStatementFilesError, ZipPasswordError,
};

fn build_zip(entries: &[(&str, &[u8])]) -> Vec<u8> {
    let mut buffer = Vec::new();
    let cursor = Cursor::new(&mut buffer);
    let mut zip = ZipWriter::new(cursor);
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
    for (name, content) in entries {
        zip.start_file(*name, options).expect("start_file");
        zip.write_all(content).expect("write");
    }
    zip.finish().expect("finish");
    buffer
}

fn build_aes_zip(entries: &[(&str, &[u8])], password: &str) -> Vec<u8> {
    let mut buffer = Vec::new();
    let cursor = Cursor::new(&mut buffer);
    let mut zip = ZipWriter::new(cursor);
    let options = SimpleFileOptions::default()
        .compression_method(CompressionMethod::Deflated)
        .with_aes_encryption(AesMode::Aes256, password);
    for (name, content) in entries {
        zip.start_file(*name, options).expect("start_file");
        zip.write_all(content).expect("write");
    }
    zip.finish().expect("finish");
    buffer
}

fn minimal_pdf_bytes() -> Vec<u8> {
    b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n".to_vec()
}

#[test]
fn extract_single_csv() {
    let data = build_zip(&[("statement.csv", b"Date,Amount\n2024-01-01,1.00\n")]);
    let extracted = extract_csvs_from_zip(&data, &[]).expect("extract");
    assert_eq!(extracted.len(), 1);
    assert_eq!(extracted[0].inner_name, "statement.csv");
    assert!(extracted[0].content.windows(10).any(|w| w == b"Date,Amoun"));
}

#[test]
fn extract_multiple_csvs() {
    let data = build_zip(&[("folder/a.csv", b"a"), ("folder/b.CSV", b"b")]);
    let extracted = extract_csvs_from_zip(&data, &[]).expect("extract");
    assert_eq!(extracted.len(), 2);
    let names: std::collections::HashSet<_> =
        extracted.iter().map(|e| e.inner_name.as_str()).collect();
    assert_eq!(names, std::collections::HashSet::from(["a.csv", "b.CSV"]));
}

#[test]
fn skips_macosx_and_non_csv() {
    let data = build_zip(&[
        ("__MACOSX/._statement.csv", b"meta"),
        ("readme.txt", b"ignore"),
        ("statement.csv", b"data"),
    ]);
    let extracted = extract_csvs_from_zip(&data, &[]).expect("extract");
    assert_eq!(extracted.len(), 1);
    assert_eq!(extracted[0].inner_name, "statement.csv");
}

#[test]
fn rejects_zip_slip_member() {
    let data = build_zip(&[("../escape.csv", b"bad")]);
    let err = extract_csvs_from_zip(&data, &[]).unwrap_err();
    assert!(err.is::<ZipNoCsvError>());
}

#[test]
fn no_csv_members_raises() {
    let data = build_zip(&[("readme.txt", b"no csv here")]);
    let err = extract_csvs_from_zip(&data, &[]).unwrap_err();
    assert!(err.is::<ZipNoCsvError>());
}

#[test]
fn invalid_zip_raises() {
    let err = extract_csvs_from_zip(b"not-a-zip", &[]).unwrap_err();
    assert!(err.to_string().contains("invalid zip archive"));
}

#[test]
fn extract_aes_encrypted_csv() {
    let data = build_aes_zip(
        &[("statement.csv", b"Date,Amount\n2024-01-01,1.00\n")],
        "secret",
    );
    let extracted = extract_csvs_from_zip(&data, &[String::from("secret")]).expect("extract");
    assert_eq!(extracted.len(), 1);
    assert_eq!(extracted[0].inner_name, "statement.csv");
}

#[test]
fn aes_password_failure_raises() {
    let data = build_aes_zip(&[("statement.csv", b"data")], "secret");
    let err = extract_csvs_from_zip(&data, &[String::from("wrong")]).unwrap_err();
    assert!(err.is::<ZipPasswordError>());
}

#[test]
fn sanitize_zip_member_name_cases() {
    assert_eq!(sanitize_zip_member_name("nested/path/file.csv"), "file.csv");
    assert_eq!(sanitize_zip_member_name("../bad.csv"), "bad.csv");
    assert_eq!(sanitize_zip_member_name(""), "attachment");
    assert_eq!(sanitize_zip_member_name("."), "attachment");
    assert_eq!(sanitize_zip_member_name(".."), "attachment");
}

#[test]
fn extract_mixed_csv_and_pdf() {
    let pdf = minimal_pdf_bytes();
    let data = build_zip(&[("statement.csv", b"Date,Amount\n"), ("statement.pdf", &pdf)]);
    let extracted = extract_statements_from_zip(&data, &[]).expect("extract");
    assert_eq!(extracted.len(), 2);
    let names: std::collections::HashSet<_> =
        extracted.iter().map(|e| e.inner_name.as_str()).collect();
    assert_eq!(
        names,
        std::collections::HashSet::from(["statement.csv", "statement.pdf"])
    );
}

#[test]
fn no_statement_files_raises() {
    let data = build_zip(&[("readme.txt", b"no statement files here")]);
    let err = extract_statements_from_zip(&data, &[]).unwrap_err();
    assert!(err.is::<ZipNoStatementFilesError>());
}
