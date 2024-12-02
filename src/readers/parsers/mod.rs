mod sources;
pub(crate) mod types;

use crate::readers::parsers::types::Parser;
use crate::readers::types::File;

pub(crate) fn get_parser(file: &File) -> Result<Parser, String> {
    let parsers = sources::get_all_parsers();

    for parser in parsers {
        if parser.identify(file)? {
            return Ok(parser);
        }
    }

    Err("error.reader.parsers.get_parser.no_matching_parser_found".to_string())
}
