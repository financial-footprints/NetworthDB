use lopdf::Document;
use tracing::info;

pub(crate) fn read_pdf(file_path: &str, file_secret: &str) -> String {
    let mut pdf = Document::load(file_path).expect("error.reader.read_pdf.cannot_open_file");

    if pdf.is_encrypted() {
        pdf.decrypt(file_secret)
            .expect("error.reader.read_pdf.cannot_decrypt_file");
    }

    let mut pdf_content = String::new();

    for (page_number, _) in pdf.get_pages().iter().enumerate() {
        let page_text = pdf.extract_text(&[page_number as u32 + 1]);
        match &page_text {
            Ok(text) => pdf_content.push_str(text),
            Err(err) => info!("info.reader.read_pdf.cannot_extract_text: {}", err),
        }
    }

    return pdf_content;
}
