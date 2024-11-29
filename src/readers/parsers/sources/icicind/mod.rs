use crate::readers::{
    parsers::types::{BankId, Parser, Statement},
    types::{File, FileType},
};

pub fn get_parser() -> Parser {
    fn identify(file: &File) -> bool {
        if !matches!(file.file_type, FileType::Xls) {
            return false;
        }

        return false;
    }

    fn parse(_: &File) -> Statement {
        todo!()
    }

    Parser {
        id: BankId::IcicInd,
        identify,
        parse,
    }
}
