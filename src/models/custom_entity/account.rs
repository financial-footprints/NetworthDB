//! Modifications to Sea-ORM generated files

use sea_orm::entity::prelude::*;

#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, DeriveIden)]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "account_type")]
pub enum AccountType {
    #[sea_orm(string_value = "checking_account")]
    CheckingAccount,
    #[sea_orm(string_value = "savings_account")]
    SavingsAccount,
    #[sea_orm(string_value = "credit_card")]
    CreditCard,
    #[sea_orm(string_value = "fixed_deposit")]
    FixedDeposit,
    #[sea_orm(string_value = "unknown")]
    Unknown,
}
