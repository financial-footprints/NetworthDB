use crate::readers::{
    parsers::types::{Parser, Statement},
    types::{File, FileType},
};

pub fn get_parser() -> Parser {
    fn identify(file: &File) -> Result<bool, String> {
        if !matches!(file.file_type, FileType::Xls) {
            return Ok(false);
        }

        return Ok(false);
    }

    fn parse(_: &File) -> Result<Statement, String> {
        todo!()
    }

    Parser { identify, parse }
}
