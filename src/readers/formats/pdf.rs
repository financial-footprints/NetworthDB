use lopdf::Document;
use tracing::info;

pub(crate) fn read_pdf_content(file_content: Vec<u8>, file_secret: &str) -> Result<String, String> {
    let mut pdf = Document::load_from(&file_content[..])
        .map_err(|_| "error.reader.formats.read_pdf_content.cannot_open_file".to_string())?;

    if pdf.is_encrypted() {
        pdf.decrypt(file_secret)
            .map_err(|_| "error.reader.formats.read_pdf_content.cannot_decrypt_file".to_string())?;
    }

    let mut pdf_content = String::new();

    for (page_number, _) in pdf.get_pages().iter().enumerate() {
        let page_text = pdf.extract_text(&[page_number as u32 + 1]);
        match &page_text {
            Ok(text) => pdf_content.push_str(text),
            Err(err) => info!(
                "info.reader.formats.read_pdf_content.cannot_extract_text: {}",
                err
            ),
        }
    }

    Ok(pdf_content)
}
