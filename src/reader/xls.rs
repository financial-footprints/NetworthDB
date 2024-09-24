use calamine::{open_workbook, Reader, Xls};

pub(crate) fn read_xls(file_path: &str) -> Vec<Vec<String>> {
    let mut workbook: Xls<_> =
        open_workbook(file_path).expect("error.reader.read_xls.cannot_open_file");
    let mut data: Vec<Vec<String>> = Vec::new();
    for sheet in workbook.sheet_names().to_owned() {
        if let Ok(range) = workbook.worksheet_range(&sheet) {
            for row in range.rows() {
                let row_data: Vec<String> = row.iter().map(|cell| cell.to_string()).collect();
                data.push(row_data);
            }
        }
    }

    return data;
}
