use crate::{
    parsers::{
        get_parser,
        types::{Parser, Statement},
    },
    reader::{read_file, types::File},
};

pub fn get_file_content(
    file_path: &String,
    file_secret: &String,
) -> (File, Parser, Vec<Statement>) {
    let file = read_file(file_path, file_secret);
    let parser = get_parser(&file);

    let parsed_data = parser.parse(&file);
    return (file, parser, parsed_data);
}
