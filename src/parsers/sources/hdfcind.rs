use regex::Regex;

use super::{BankId, Parser, Statement};
use crate::reader::types::{File, FileData, FileType};

pub fn get_parser() -> Parser {
    fn identify(file: &File) -> bool {
        let data = &file.data;

        match data {
            FileData::Table(data) => {
                if let Some(first_row) = data.first() {
                    if let Some(first_cell) = first_row.first() {
                        if first_cell.contains("HDFC BANK Ltd.") {
                            return true;
                        }
                    }
                }
            }
            FileData::Text(data) => {
                if matches!(file.file_type, FileType::Pdf)
                    && data.contains("Statementofaccount")
                    && data.contains("HDFCBANKLIMITED")
                {
                    return true;
                }
            }
        }

        return false;
    }

    fn parse(file: &File) -> Vec<Statement> {
        let data = &file.data;
        match data {
            FileData::Table(data) => {
                return parse_xls(data);
            }
            FileData::Text(data) => {
                return parse_pdf(data);
            }
        }
    }

    Parser {
        id: BankId::HdfcInd,
        identify,
        parse,
    }
}

fn parse_pdf(source: &str) -> Vec<Statement> {
    let mut data = source.to_string();

    // Remove all the sections not a part of the statement
    data = Regex::new(r"(?ms)PageNo.*?Mumbai400013")
        .expect("error.parser.hdfcind.regex_creation_failed_1")
        .replace_all(&data, "")
        .to_string();

    data = Regex::new(r"(?ms)STATEMENTSUMMARY.*")
        .expect("error.parser.hdfcind.regex_creation_failed_2")
        .replace_all(&data, "")
        .to_string();

    data = Regex::new(r"(?ms)\nDate.*ClosingBalance ")
        .expect("error.parser.hdfcind.regex_creation_failed_3")
        .replace_all(&data, "")
        .to_string();

    // Build statement, one transaction at a time
    let mut statements = Vec::new();

    // The statement is split into two lines
    let line1 = Regex::new(r"(?ms)\d{2}/\d{2}/\d{2}.*?\d{2}/\d{2}/\d{2}")
        .expect("error.parser.hdfcind.regex_creation_failed_4");
    let line2 = Regex::new(r"(?s).*?(\d{2}/\d{2}/\d{2})")
        .expect("error.parser.hdfcind.regex_creation_failed_5");

    while !data.is_empty() {
        let mut description = String::new();
        let mut withdrawal: f64 = 0.0;
        let mut deposit: f64 = 0.0;
        let mut balance: f64 = 0.0;

        // Capture transaction's 1st line
        let capture1 = line1
            .find(&data)
            .expect("error.parser.hdfcind.line1_not_found");

        let parts1: Vec<&str> = capture1
            .as_str()
            .trim()
            .split('\n')
            .map(|part| part.trim())
            .collect();
        let date = parts1[0].to_string();
        let ref_no = parts1[2].to_string();
        description.push_str(parts1[1]);

        data = (&data[capture1.end()..]).to_string();

        // Capture transaction's 2nd line
        let remaining_data;
        let parts2: Vec<&str> = if let Some(capture2) = line2.find(&data) {
            remaining_data = (&data[capture2.end() - 8..]).to_string();
            capture2.as_str()[..capture2.end() - 8]
                .trim()
                .split('\n')
                .map(|part| part.trim())
                .collect()
        } else {
            remaining_data = "".to_string();
            data.trim().split('\n').map(|part| part.trim()).collect()
        };

        let number_collection = parts2[0].replace(",", "");
        if let Some(dot_index) = number_collection.chars().position(|c| c == '.') {
            if dot_index + 2 < number_collection.len() - 1 {
                deposit = number_collection[..dot_index + 3]
                    .parse::<f64>()
                    .unwrap_or(0.0);

                balance = number_collection[dot_index + 1..]
                    .parse::<f64>()
                    .unwrap_or(0.0);

                description.push_str(&parts2[1..].join(""));
            } else {
                balance = parts2[1].replace(",", "").parse::<f64>().unwrap_or(0.0);
                withdrawal = number_collection.parse::<f64>().unwrap_or(0.0);
                description.push_str(&parts2[2..].join(""));
            }
        }

        data = remaining_data;

        // Build the statement
        statements.push(Statement {
            date,
            description,
            ref_no,
            withdrawal,
            deposit,
            balance,
        });
    }

    return statements;
}

fn parse_xls(table: &Vec<Vec<String>>) -> Vec<Statement> {
    let mut statements = Vec::new();

    let data_start_index = table
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

    let data_end_index = table[data_start_index..]
        .iter()
        .position(|row| row == &["", "", "", "", "", "", ""])
        .expect("error.parser.hdfcind.end_of_data_not_found")
        + data_start_index;

    for row in &table[data_start_index..data_end_index] {
        let date = row[0].trim().to_string();
        let description = row[1].trim().to_string();
        let ref_no = row[2].trim().to_string();
        let withdrawal = row[4].trim().parse::<f64>().unwrap_or(0.0);
        let deposit = row[5].trim().parse::<f64>().unwrap_or(0.0);
        let balance = row[6].trim().parse::<f64>().unwrap_or(0.0);

        statements.push(Statement {
            date,
            description,
            ref_no,
            withdrawal,
            deposit,
            balance,
        });
    }

    return statements;
}
