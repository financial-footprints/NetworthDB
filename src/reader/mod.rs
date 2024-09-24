pub mod types;

mod pdf;
mod xls;
use crate::reader::pdf::read_pdf;
use crate::reader::xls::read_xls;

use crate::reader::types::File;
use crate::reader::types::FileType;

pub fn read_file(file_path: &str) -> File {
    let file_extension = std::path::Path::new(file_path)
        .extension()
        .and_then(std::ffi::OsStr::to_str);

    if file_extension == Some("xls") {
        return File {
            file_type: FileType::Xls,
            data: read_xls(file_path),
        };
    }

    if file_extension == Some("pdf") {
        return File {
            file_type: FileType::Pdf,
            data: read_pdf(file_path),
        };
    }

    panic!("error.reader.read_file.unsupported_file_type");
}
