use super::common::{make_transaction, parse_dated_amount_line, Transaction};

pub struct YesStatementParser;

impl YesStatementParser {
    pub fn parse(text: &str, source_file: &str) -> Vec<Transaction> {
        let mut rows = Vec::new();
        for line in text.lines() {
            if line.to_lowercase().contains("nil transaction") {
                continue;
            }
            if let Some((txn_date, description, amount, direction)) = parse_dated_amount_line(line)
            {
                rows.push(make_transaction(
                    txn_date,
                    description,
                    amount,
                    &direction,
                    source_file,
                    None,
                ));
            }
        }
        rows
    }
}
