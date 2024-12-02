use crate::{models::custom_entity::account::AccountType, readers::types::File};
use sea_orm::prelude::{DateTimeUtc, Decimal};

#[derive(Debug)]
pub struct Statement {
    pub account_number: String,
    pub account_type: AccountType,
    pub date: DateTimeUtc,
    pub transactions: Vec<Transaction>,
}

#[derive(Debug)]
pub struct Transaction {
    pub date: DateTimeUtc,
    pub description: String,
    pub ref_no: String,
    pub withdrawal: Decimal,
    pub deposit: Decimal,
    pub balance: Decimal,
}

pub struct Parser {
    pub identify: fn(&File) -> Result<bool, String>,
    pub parse: fn(&File) -> Result<Statement, String>,
}

impl Parser {
    pub fn identify(&self, file: &File) -> Result<bool, String> {
        (self.identify)(file)
    }

    pub fn parse(&self, file: &File) -> Result<Statement, String> {
        (self.parse)(file)
    }
}
