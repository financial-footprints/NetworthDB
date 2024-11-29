use crate::{models::custom_entity::account::AccountType, readers::types::File};
use sea_orm::prelude::{DateTimeUtc, Decimal};

#[derive(Debug)]
pub struct Transaction {
    pub date: DateTimeUtc,
    pub description: String,
    pub ref_no: String,
    pub withdrawal: Decimal,
    pub deposit: Decimal,
    pub balance: Decimal,
}

pub struct Statement {
    pub account_number: String,
    pub account_type: AccountType,
    pub date: DateTimeUtc,
    pub transactions: Vec<Transaction>,
}

pub enum BankId {
    HdfcInd,
    IcicInd,
}

impl BankId {
    pub fn to_string(&self) -> String {
        match self {
            BankId::HdfcInd => "hdfcind".to_string(),
            BankId::IcicInd => "icicind".to_string(),
        }
    }
}

pub struct Parser {
    pub id: BankId,
    pub identify: fn(&File) -> bool,
    pub parse: fn(&File) -> Statement,
}

impl Parser {
    pub fn identify(&self, file: &File) -> bool {
        (self.identify)(file)
    }

    pub fn parse(&self, file: &File) -> Statement {
        (self.parse)(file)
    }
}
