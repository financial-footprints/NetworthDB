use crate::models::{
    entities::{accounts, sea_orm_active_enums},
    helpers::SortDirection,
};
use sea_orm_active_enums::AccountType;
use uuid::Uuid;

use super::StringFilterType;

pub struct AccountSort {
    pub column: accounts::Column,
    pub direction: SortDirection,
}

#[derive(Default)]
pub struct AccountFilter {
    pub id: Option<Uuid>,
    pub account_number: Option<(StringFilterType, String)>,
    pub r#type: Option<AccountType>,
}

#[derive(Default)]
pub struct AccountsQueryOptions {
    pub filter: Option<AccountFilter>,
    pub sort: Option<AccountSort>,
    pub limit: Option<u64>,
    pub offset: Option<u64>,
}
