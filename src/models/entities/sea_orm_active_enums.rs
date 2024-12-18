//! `SeaORM` Entity, @generated by sea-orm-codegen 1.1.1

use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize)]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "account_type")]
pub enum AccountType {
    #[sea_orm(string_value = "checking_account")]
    CheckingAccount,
    #[sea_orm(string_value = "credit_card")]
    CreditCard,
    #[sea_orm(string_value = "fixed_deposit")]
    FixedDeposit,
    #[sea_orm(string_value = "savings_account")]
    SavingsAccount,
    #[sea_orm(string_value = "unknown")]
    Unknown,
}
#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize)]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "institution_name")]
pub enum InstitutionName {
    #[sea_orm(string_value = "Axis")]
    Axis,
    #[sea_orm(string_value = "BankOfBaroda")]
    BankOfBaroda,
    #[sea_orm(string_value = "Citi")]
    Citi,
    #[sea_orm(string_value = "Hdfc")]
    Hdfc,
    #[sea_orm(string_value = "Icici")]
    Icici,
    #[sea_orm(string_value = "Idfc")]
    Idfc,
    #[sea_orm(string_value = "IndusInd")]
    IndusInd,
    #[sea_orm(string_value = "Jupiter")]
    Jupiter,
    #[sea_orm(string_value = "OneCard")]
    OneCard,
    #[sea_orm(string_value = "Other")]
    Other,
    #[sea_orm(string_value = "PunjabNationalBank")]
    PunjabNationalBank,
    #[sea_orm(string_value = "StateBankOfIndia")]
    StateBankOfIndia,
    #[sea_orm(string_value = "Yes")]
    Yes,
}
