//! Exposes functions that will allow you to read financial files like Statement pdf, xls etc
//! It should take the file as input and return relevant data from the file.
mod formats;
pub(crate) mod parsers;
mod types;

use crate::readers::parsers::types::Statement;

/// Reads and parses a financial file (PDF, XLS, etc.)
///
/// # Arguments
/// * `file_path` - Path to the file to read
/// * `file_secret` - Password/secret needed to decrypt the file (if encrypted); empty string if not encrypted
///
/// # Returns
/// The parsed statement data
///
/// # Errors
/// Returns an error if:
/// * The file cannot be read
/// * The file format is unsupported
/// * The file cannot be parsed
pub fn get_statement_from_file(
    file_path: &String,
    file_secret: &String,
) -> Result<Statement, String> {
    let file_content = formats::load_file_content(file_path)?;
    get_statement_from_file_content(file_content, file_secret)
}

/// Reads and parses a financial file (PDF, XLS, etc.) from raw file content
///
/// # Arguments
/// * `file_content` - Raw bytes of the file content
/// * `file_secret` - Password/secret needed to decrypt the file (if encrypted); empty string if not encrypted
///
/// # Returns
/// The parsed statement data
///
/// # Errors
/// Returns an error if:
/// * The file format is unsupported
/// * The file cannot be parsed
pub fn get_statement_from_file_content(
    file_content: Vec<u8>,
    file_secret: &String,
) -> Result<Statement, String> {
    let file = formats::read_file_content(file_content, file_secret)?;
    let parser = parsers::get_parser(&file)?;
    let parsed_data = parser.parse(&file)?;
    Ok(parsed_data)
}
