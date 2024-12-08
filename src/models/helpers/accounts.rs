use crate::models::entities::{accounts, sea_orm_active_enums};
use sea_orm::Order;
use sea_orm_active_enums::AccountType;
use serde::Deserialize;
use uuid::Uuid;

use super::StringFilterType;

pub struct AccountSort {
    pub column: accounts::Column,
    pub direction: Order,
}

impl Default for AccountSort {
    fn default() -> Self {
        AccountSort {
            column: accounts::Column::UpdatedAt,
            direction: Order::Asc,
        }
    }
}

impl<'de> Deserialize<'de> for AccountSort {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        #[derive(Deserialize)]
        struct AccountSortHelper {
            column: Option<String>,
            direction: Option<String>,
        }

        let helper = AccountSortHelper::deserialize(deserializer)?;

        let column = match helper.column.as_deref() {
            Some("id") => accounts::Column::Id,
            Some("account_number") => accounts::Column::AccountNumber,
            Some("type") => accounts::Column::Type,
            Some("updated_at") => accounts::Column::UpdatedAt,
            None => accounts::Column::UpdatedAt,
            _ => return Err(serde::de::Error::custom("Invalid column value")),
        };

        let direction = match helper.direction.as_deref() {
            Some("asc") => Order::Asc,
            Some("desc") => Order::Desc,
            None => Order::Asc,
            _ => return Err(serde::de::Error::custom("Invalid direction value")),
        };

        Ok(AccountSort { column, direction })
    }
}

#[derive(Default, Deserialize)]
pub struct AccountFilter {
    pub id: Option<Uuid>,
    pub account_number: Option<(StringFilterType, String)>,
    pub r#type: Option<AccountType>,
}

#[derive(Default, Deserialize)]
pub struct AccountsQueryOptions {
    pub filter: Option<AccountFilter>,
    pub sort: Option<AccountSort>,
    pub limit: Option<u64>,
    pub offset: Option<u64>,
}
