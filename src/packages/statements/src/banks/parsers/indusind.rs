use super::common::{
    line_has_dr_cr_marker, make_transaction, parse_dated_amount_line, Transaction,
};

pub struct IndusindStatementParser;

impl IndusindStatementParser {
    pub fn parse(text: &str, source_file: &str) -> Vec<Transaction> {
        let mut rows = Vec::new();
        for line in text.lines() {
            let stripped = line.trim();
            if stripped.to_uppercase().starts_with("TOTAL") {
                continue;
            }
            if stripped.contains(" To ") {
                continue;
            }
            if !line_has_dr_cr_marker(line) {
                continue;
            }
            if let Some((txn_date, mut description, amount, direction)) =
                parse_dated_amount_line(line)
            {
                let parts: Vec<&str> = description.split_whitespace().collect();
                if parts.len() == 2 && parts[1].chars().all(|c| c.is_ascii_digit()) {
                    description = parts[0].to_string();
                }
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
