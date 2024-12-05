mod pdf;
mod xls;

use crate::readers::types::{File, FileData, FileType};
use pdf::read_pdf_content;
use xls::read_xls_content;

pub(super) fn load_file_content(file_path: &str) -> Result<Vec<u8>, String> {
    std::fs::read(file_path)
        .map_err(|_| "error.reader.formats.load_file_content.cannot_open_file".to_string())
}

pub(super) fn read_file_content(file_content: Vec<u8>, file_secret: &str) -> Result<File, String> {
    let file_type = infer::get(&file_content)
        .map(|t| t.extension())
        .or_else(|| None);

    if file_type == Some("xls") || file_type == Some("xlsx") {
        let table_data = read_xls_content(file_content)?;
        return Ok(File {
            file_type: FileType::Xls,
            data: FileData::Table(table_data),
        });
    }

    if file_type == Some("pdf") {
        let text_data = read_pdf_content(file_content, file_secret)?;
        return Ok(File {
            file_type: FileType::Pdf,
            data: FileData::Text(text_data),
        });
    }

    Err(format!(
        "error.reader.read_file.unsupported_file_type: {:?}",
        file_type
    ))
}
