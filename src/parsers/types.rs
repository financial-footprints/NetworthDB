use crate::reader::types::File;

pub struct Statement {
    pub date: String,
    pub description: String,
    pub withdrawal: f64,
    pub deposit: f64,
    pub balance: f64,
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
    pub parse: fn(&File) -> Vec<Statement>,
}

impl Parser {
    pub fn identify(&self, file: &File) -> bool {
        (self.identify)(file)
    }

    pub fn parse(&self, file: &File) -> Vec<Statement> {
        (self.parse)(file)
    }
}
