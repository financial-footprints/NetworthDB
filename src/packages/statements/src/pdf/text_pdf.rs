//! Minimal text-layer PDF writer for Bruno / test fixtures.

use std::path::Path;

use lopdf::content::{Content, Operation};
use lopdf::dictionary;
use lopdf::{Document, Object, Stream};

use super::PdfError;

pub fn write_text_pdf(path: &Path, text: &str) -> Result<(), PdfError> {
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

    let mut operations = vec![
        Operation::new("BT", vec![]),
        Operation::new("Tf", vec!["F1".into(), 9.into()]),
        Operation::new("Td", vec![40.into(), 800.into()]),
    ];

    for (index, line) in text.lines().enumerate() {
        if index > 0 {
            operations.push(Operation::new("Td", vec![0.into(), (-11).into()]));
        }
        operations.push(Operation::new("Tj", vec![Object::string_literal(line)]));
    }
    operations.push(Operation::new("ET", vec![]));

    let content = Content { operations };
    let content_id = doc.add_object(Stream::new(
        dictionary! {},
        content
            .encode()
            .map_err(|err| PdfError::new(format!("pdf content encode failed: {}", err)))?,
    ));

    let page_id = doc.add_object(dictionary! {
        "Type" => "Page",
        "Parent" => pages_id,
        "Contents" => content_id,
        "Resources" => resources_id,
        "MediaBox" => vec![0.into(), 0.into(), 595.into(), 842.into()],
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

    doc.save(path)
        .map_err(|err| PdfError::new(format!("pdf save failed: {}", err)))?;
    Ok(())
}
