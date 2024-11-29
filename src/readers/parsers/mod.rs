mod sources;
pub(crate) mod types;

use crate::readers::parsers::types::Parser;
use crate::readers::types::File;

pub(crate) fn get_parser(file: &File) -> Parser {
    let parsers = sources::get_all_parsers();

    for parser in parsers {
        if parser.identify(file) {
            return parser;
        }
    }

    panic!("No matching parser found for the given file data");
}
