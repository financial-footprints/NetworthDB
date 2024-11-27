mod config;
mod parsers;
mod reader;

use parsers::types::{Parser, Statement};
use reader::types::File;

fn main() {
    let config = &config::CONFIG;
    let (file, parser, parsed_data) = get_file_content(&config.file_path, &config.file_secret);

    for statement in parsed_data {
        println!(
            "Date: {}, Description: {}, Ref No: {}, Withdrawal: {}, Deposit: {}, Balance: {}",
            statement.date,
            statement.description,
            statement.ref_no,
            statement.withdrawal,
            statement.deposit,
            statement.balance
        );
    }

    println!("File Type: {}", file.file_type.to_string());
    println!("Parser: {}", parser.id.to_string());
}

fn get_file_content(file_path: &String, file_secret: &String) -> (File, Parser, Vec<Statement>) {
    let file = reader::read_file(file_path, file_secret);
    let parser = parsers::get_parser(&file);

    let parsed_data = parser.parse(&file);
    return (file, parser, parsed_data);
}
