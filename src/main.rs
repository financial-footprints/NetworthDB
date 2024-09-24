mod parsers;
mod reader;

use std::{env, fs};

use parsers::types::{Parser, Statement};
use reader::types::File;

fn process_bank_data() -> Vec<String> {
    dotenv::dotenv().ok();
    let file_path = env::var("PROCESS_BANK_DATA_FOLDER")
        .expect("error.main.process_bank_data.folder_not_found");

    let files = fs::read_dir(file_path).expect("error.main.process_bank_data.cannot_read_folder");

    let file_paths = files
        .map(|entry| {
            entry
                .expect("error.main.process_bank_data.cannot_read_file")
                .path()
                .display()
                .to_string()
        })
        .collect::<Vec<String>>();

    return file_paths;
}

fn main() {
    let files = process_bank_data();

    for file_path in files {
        let (file, parser, parsed_data) = get_file_content(file_path);

        for statement in parsed_data {
            println!(
                "Date: {}, Description: {}, Withdrawal: {}, Deposit: {}, Balance: {}",
                statement.date,
                statement.description,
                statement.withdrawal,
                statement.deposit,
                statement.balance
            );
        }

        println!("File Type: {}", file.file_type.to_string());
        println!("Parser: {}", parser.id.to_string());
    }
}

fn get_file_content(file_path: String) -> (File, Parser, Vec<Statement>) {
    let file = reader::read_file(&file_path);
    let parser = parsers::get_parser(&file);

    let parsed_data = parser.parse(&file);
    return (file, parser, parsed_data);
}
