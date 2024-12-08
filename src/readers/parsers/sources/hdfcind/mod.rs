use regex::Regex;

use crate::{
    models::entities::sea_orm_active_enums::AccountType,
    readers::{
        parsers::types::{Parser, Statement, Transaction},
        types::{File, FileData, FileType},
    },
    utils,
};

pub fn get_parser() -> Parser {
    fn identify(file: &File) -> Result<bool, String> {
        let data = &file.data;

        match data {
            FileData::Table(data) => {
                let is_xls = matches!(file.file_type, FileType::Xls);
                let first_cell = data.first().and_then(|row| row.first());
                let contains_hdfc = first_cell
                    .map(|cell| cell.contains("HDFC BANK Ltd."))
                    .unwrap_or(false);

                if is_xls && contains_hdfc {
                    return Ok(true);
                }
            }
            FileData::Text(data) => {
                if matches!(file.file_type, FileType::Pdf)
                    && data.contains("Statementofaccount")
                    && data.contains("HDFCBANKLIMITED")
                {
                    return Ok(true);
                }
            }
        }

        return Ok(false);
    }

    fn parse(file: &File) -> Result<Statement, String> {
        let data = &file.data;
        match data {
            FileData::Table(data) => parse_xls(data),
            FileData::Text(data) => parse_pdf(data),
        }
    }

    Parser { identify, parse }
}

fn parse_xls(table: &Vec<Vec<String>>) -> Result<Statement, String> {
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

    let transactions = parse_trnx_xls(table)?;

    Ok(Statement {
        transactions,
        account_type,
        date: statement_date,
    })
}

fn parse_trnx_xls(table: &Vec<Vec<String>>) -> Result<Vec<Transaction>, String> {
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
        .ok_or("error.parser.hdfcind.start_of_data_not_found")?
        + 2;

    let data_end_index = table[data_start_index..]
        .iter()
        .position(|row| row == &["", "", "", "", "", "", ""])
        .ok_or("error.parser.hdfcind.end_of_data_not_found")?
        + data_start_index;

    for row in &table[data_start_index..data_end_index] {
        let date = utils::datetime::date_str_to_datetime(&row[0]);
        let description = row[1].trim().to_string();
        let ref_no = row[2].trim().to_string();
        let withdrawal = row[4].trim().parse::<f32>().unwrap_or(0.0);
        let deposit = row[5].trim().parse::<f32>().unwrap_or(0.0);
        let balance = row[6].trim().parse::<f32>().unwrap_or(0.0);

        transactions.push(Transaction {
            date,
            description,
            ref_no,
            withdrawal,
            deposit,
            balance,
        });
    }

    Ok(transactions)
}

fn parse_pdf(data: &str) -> Result<Statement, String> {
    let account_type = if data.contains("Statementofaccount") {
        AccountType::SavingsAccount
    } else {
        AccountType::Unknown
    };

    let date = {
        Regex::new(r"StatementFrom:.*?To:(\d{2}/\d{2}/\d{4})")
            .map_err(|_| "error.parser.hdfcind.regex_creation_failed_6")?
            .captures(&data)
            .and_then(|cap| cap.get(1))
            .map(|m| utils::datetime::date_str_to_datetime(m.as_str()))
            .unwrap_or_else(|| utils::datetime::get_current_datetime())
    };

    let transactions = parse_trnx_pdf(&data)?;

    Ok(Statement {
        transactions,
        account_type,
        date,
    })
}

fn parse_trnx_pdf(source: &str) -> Result<Vec<Transaction>, String> {
    let mut data = source.to_string();

    // Remove all the sections not a part of the statement
    data = Regex::new(r"(?ms)PageNo.*?Mumbai400013")
        .map_err(|_| "error.parser.hdfcind.regex_creation_failed_1")?
        .replace_all(&data, "")
        .to_string();

    data = Regex::new(r"(?ms)STATEMENTSUMMARY.*")
        .map_err(|_| "error.parser.hdfcind.regex_creation_failed_2")?
        .replace_all(&data, "")
        .to_string();

    data = Regex::new(r"(?ms)\nDate.*ClosingBalance ")
        .map_err(|_| "error.parser.hdfcind.regex_creation_failed_3")?
        .replace_all(&data, "")
        .to_string();

    // Build statement, one transaction at a time
    let mut statements = Vec::new();

    // The statement is split into two lines
    let line1 = Regex::new(r"(?ms)\d{2}/\d{2}/\d{2}.*?\d{2}/\d{2}/\d{2}")
        .map_err(|_| "error.parser.hdfcind.regex_creation_failed_4")?;
    let line2 = Regex::new(r"(?s).*?(\d{2}/\d{2}/\d{2})")
        .map_err(|_| "error.parser.hdfcind.regex_creation_failed_5")?;

    while !data.is_empty() {
        let mut description = String::new();
        let mut withdrawal = 0.0;
        let mut deposit = 0.0;
        let mut balance = 0.0;

        // Capture transaction's 1st line
        let capture1 = line1
            .find(&data)
            .ok_or("error.parser.hdfcind.line1_not_found")?;

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
                    .parse::<f32>()
                    .unwrap_or(0.0);

                balance = number_collection[dot_index + 1..]
                    .parse::<f32>()
                    .unwrap_or(0.0);

                description.push_str(&parts2[1..].join(""));
            } else {
                balance = parts2[1].replace(",", "").parse::<f32>().unwrap_or(0.0);
                withdrawal = number_collection.parse::<f32>().unwrap_or(0.0);
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

    Ok(statements)
}

#[cfg(test)]
mod tests;
