//! Exposes functions that will allow you to read financial files like Statement pdf, xls etc
//! It should take the file as input and return relevant data from the file.
mod formats;
pub(crate) mod parsers;
mod types;

use crate::readers::{
    parsers::types::{Parser, Statement},
    types::File,
};

/// Reads and parses a financial file (PDF, XLS, etc.)
///
/// # Arguments
/// * `file_path` - Path to the file to read
/// * `file_secret` - Password/secret needed to decrypt the file (if encrypted); empty string if not encrypted
///
/// # Returns
/// A tuple containing:
/// * The raw file content as a `File` enum
/// * The parser used to interpret the file
/// * The parsed statement data
pub fn get_statement_from_file(
    file_path: &String,
    file_secret: &String,
) -> (File, Parser, Statement) {
    let file = formats::read_file(file_path, file_secret);
    let parser = parsers::get_parser(&file);

    let parsed_data = parser.parse(&file);
    return (file, parser, parsed_data);
}
