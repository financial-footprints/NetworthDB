use super::{BankId, Parser, Statement};
use crate::reader::types::{File, FileType};

pub fn get_parser() -> Parser {
    fn identify(file: &File) -> bool {
        if matches!(file.file_type, FileType::Xls) {
            if let Some(first_row) = file.data.first() {
                if let Some(first_cell) = first_row.first() {
                    if first_cell.contains("HDFC BANK Ltd.") {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    fn parse(file: &File) -> Vec<Statement> {
        let mut statements = Vec::new();

        let data_start_index = file
            .data
            .iter()
            .position(|row| {
                row == &[
                    "Date",
                    "Narration",
                    "Chq./Ref.No.",
                    "Value Dt",
                    "Withdrawal Amt.",
                    "Deposit Amt.",
                    "Closing Balance",
                ]
            })
            .expect("error.parser.hdfcind.start_of_data_not_found")
            + 2;

        let data_end_index = file.data[data_start_index..]
            .iter()
            .position(|row| row == &["", "", "", "", "", "", ""])
            .expect("error.parser.hdfcind.end_of_data_not_found")
            + data_start_index;

        for row in &file.data[data_start_index..data_end_index] {
            let date = row[0].trim().to_string();
            let description = row[1].trim().to_string();
            let withdrawal = row[4].trim().parse::<f64>().unwrap_or(0.0);
            let deposit = row[5].trim().parse::<f64>().unwrap_or(0.0);
            let balance = row[6].trim().parse::<f64>().unwrap_or(0.0);

            statements.push(Statement {
                date,
                description,
                withdrawal,
                deposit,
                balance,
            });
        }

        statements
    }

    Parser {
        id: BankId::HdfcInd,
        identify,
        parse,
    }
}
