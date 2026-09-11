use super::common::{parse_dd_mon_rs_dr_cr_line, parse_stop_at_end_lines, Transaction};

pub struct CsbStatementParser;

impl CsbStatementParser {
    pub fn parse(text: &str, source_file: &str) -> Vec<Transaction> {
        parse_stop_at_end_lines(
            text,
            parse_dd_mon_rs_dr_cr_line,
            source_file,
            "End of Transactions",
        )
    }
}
