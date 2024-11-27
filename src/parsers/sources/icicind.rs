use super::{BankId, Parser, Statement};
use crate::reader::types::{File, FileType};

pub fn get_parser() -> Parser {
    fn identify(file: &File) -> bool {
        if !matches!(file.file_type, FileType::Xls) {
            return false;
        }

        return false;
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
