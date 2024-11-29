pub(crate) mod parsers;
mod types;

mod pdf;
mod xls;

use crate::readers::{
    parsers::{
        get_parser,
        types::{Parser, Statement},
    },
    pdf::read_pdf,
    xls::read_xls,
};

use crate::readers::types::{File, FileData, FileType};

pub fn get_file_content(file_path: &String, file_secret: &String) -> (File, Parser, Statement) {
    let file = read_file(file_path, file_secret);
    let parser = get_parser(&file);

    let parsed_data = parser.parse(&file);
    return (file, parser, parsed_data);
}

pub(crate) fn read_file(file_path: &str, file_secret: &str) -> File {
    let file_extension = std::path::Path::new(file_path)
        .extension()
        .and_then(std::ffi::OsStr::to_str);

    if file_extension == Some("xls") || file_extension == Some("xlsx") {
        return File {
            file_type: FileType::Xls,
            data: FileData::Table(read_xls(file_path, file_secret)),
        };
    }

    if file_extension == Some("pdf") {
        return File {
            file_type: FileType::Pdf,
            data: FileData::Text(read_pdf(file_path, file_secret)),
        };
    }

    panic!("error.reader.read_file.unsupported_file_type");
}
