use networth_db;
mod config;

fn main() {
    let config = &config::CONFIG;
    let (file, parser, parsed_data) =
        networth_db::composer::get_file_content(&config.file_path, &config.file_secret);

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
