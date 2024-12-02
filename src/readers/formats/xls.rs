use calamine::{Reader, Xls};

pub(crate) fn read_xls_content(file_content: Vec<u8>) -> Result<Vec<Vec<String>>, String> {
    let cursor = std::io::Cursor::new(file_content);
    let mut workbook: Xls<_> = match Xls::new(cursor) {
        Ok(wb) => wb,
        Err(_) => return Err("error.reader.read_xls.cannot_open_file".to_string()),
    };
    let mut data: Vec<Vec<String>> = Vec::new();
    for sheet in workbook.sheet_names().to_owned() {
        if let Ok(range) = workbook.worksheet_range(&sheet) {
            for row in range.rows() {
                let row_data: Vec<String> = row.iter().map(|cell| cell.to_string()).collect();
                data.push(row_data);
            }
        }
    }

    Ok(data)
}
