use super::{BankId, Parser, Statement};
use crate::reader::types::{File, FileType};

pub fn get_parser() -> Parser {
    fn identify(file: &File) -> bool {
        if !matches!(file.file_type, FileType::Xls) {
            return false;
        }

        if let Some(first_row) = file.data.first() {
            if let Some(first_cell) = first_row.first() {
                if first_cell.contains("ICICI") {
                    return true;
                }
            }
        }

        false
    }

    fn parse(file: &File) -> Vec<Statement> {
        let _ = file;
        return Vec::new();
    }

    Parser {
        id: BankId::IcicInd,
        identify,
        parse,
    }
}
