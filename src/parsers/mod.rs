mod sources;
pub mod types;

use crate::parsers::types::Parser;
use crate::reader::types::File;

pub fn get_parser(file: &File) -> Parser {
    let parsers = sources::get_all_parsers();

    for parser in parsers {
        if parser.identify(file) {
            return parser;
        }
    }

    panic!("No matching parser found for the given file data");
}
