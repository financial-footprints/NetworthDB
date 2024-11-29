use regex::Regex;
use sea_orm::prelude::Decimal;

use crate::{
    models::custom_entity::account::AccountType,
    readers::{
        parsers::types::{BankId, Parser, Statement, Transaction},
        types::{File, FileData, FileType},
    },
    utils,
};

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

    fn parse(file: &File) -> Statement {
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

fn parse_xls(table: &Vec<Vec<String>>) -> Statement {
    let mut account_number = String::new();
    let current_time = utils::datetime::get_current_datetime();
    let mut statement_date = current_time;
    let mut account_type = AccountType::Unknown;

    for row in table {
        for cell in row {
            if cell.contains("Account No :") {
                account_number = cell
                    .split("Account No :")
                    .nth(1)
                    .unwrap_or("")
                    .split_whitespace()
                    .next()
                    .unwrap_or("")
                    .to_string();
            }

            if cell.contains("Statement From") {
                let date_str = cell.split("To  :").nth(1).unwrap_or("").trim();
                statement_date = utils::datetime::date_str_to_datetime(date_str);
            }

            if cell.contains("Statement of accounts") {
                account_type = AccountType::SavingsAccount;
            }
        }

        if !account_number.is_empty() && statement_date != current_time {
            break;
        }
    }

    let transactions = parse_trnx_xls(table);

    return Statement {
        transactions,
        account_number,
        account_type,
        date: statement_date,
    };
}

fn parse_trnx_xls(table: &Vec<Vec<String>>) -> Vec<Transaction> {
    let mut transactions = Vec::new();

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
        let date = utils::datetime::date_str_to_datetime(&row[0]);
        let description = row[1].trim().to_string();
        let ref_no = row[2].trim().to_string();
        let withdrawal = row[4].trim().parse::<Decimal>().unwrap_or(Decimal::ZERO);
        let deposit = row[5].trim().parse::<Decimal>().unwrap_or(Decimal::ZERO);
        let balance = row[6].trim().parse::<Decimal>().unwrap_or(Decimal::ZERO);

        transactions.push(Transaction {
            date,
            description,
            ref_no,
            withdrawal,
            deposit,
            balance,
        });
    }

    return transactions;
}

fn parse_pdf(data: &str) -> Statement {
    let account_type = if data.contains("Statementofaccount") {
        AccountType::SavingsAccount
    } else {
        AccountType::Unknown
    };

    let account_number = Regex::new(r"AccountNo:(\d+)")
        .expect("error.parser.hdfcind.regex_creation_failed_7")
        .captures(&data)
        .and_then(|cap| cap.get(1))
        .map(|m| m.as_str().to_string())
        .unwrap_or_else(String::new);

    let date = {
        Regex::new(r"StatementFrom:.*?To:(\d{2}/\d{2}/\d{4})")
            .expect("error.parser.hdfcind.regex_creation_failed_6")
            .captures(&data)
            .and_then(|cap| cap.get(1))
            .map(|m| utils::datetime::date_str_to_datetime(m.as_str()))
            .unwrap_or_else(|| utils::datetime::get_current_datetime())
    };

    let transactions = parse_trnx_pdf(&data);

    return Statement {
        transactions,
        account_number,
        account_type,
        date,
    };
}

fn parse_trnx_pdf(source: &str) -> Vec<Transaction> {
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
        let mut withdrawal: Decimal = Decimal::ZERO;
        let mut deposit: Decimal = Decimal::ZERO;
        let mut balance: Decimal = Decimal::ZERO;

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
        let date = utils::datetime::date_str_to_datetime(&parts1[0]);
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
                    .parse::<Decimal>()
                    .unwrap_or(Decimal::ZERO);

                balance = number_collection[dot_index + 1..]
                    .parse::<Decimal>()
                    .unwrap_or(Decimal::ZERO);

                description.push_str(&parts2[1..].join(""));
            } else {
                balance = parts2[1]
                    .replace(",", "")
                    .parse::<Decimal>()
                    .unwrap_or(Decimal::ZERO);
                withdrawal = number_collection
                    .parse::<Decimal>()
                    .unwrap_or(Decimal::ZERO);
                description.push_str(&parts2[2..].join(""));
            }
        }

        data = remaining_data;

        // Build the statement
        statements.push(Transaction {
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

#[cfg(test)]
mod tests;
