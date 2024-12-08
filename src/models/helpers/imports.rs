use crate::models::entities::imports;
use sea_orm::{prelude::DateTime, Order};
use serde::Deserialize;
use uuid::Uuid;

use super::{DateFilterType, StringFilterType};

pub struct ImportSort {
    pub column: imports::Column,
    pub direction: Order,
}

impl Default for ImportSort {
    fn default() -> Self {
        ImportSort {
            column: imports::Column::ImportDate,
            direction: Order::Asc,
        }
    }
}

impl<'de> Deserialize<'de> for ImportSort {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        #[derive(Deserialize)]
        struct ImportSortHelper {
            column: Option<String>,
            direction: Option<String>,
        }

        let helper = ImportSortHelper::deserialize(deserializer)?;

        let column = match helper.column.as_deref() {
            Some("id") => imports::Column::Id,
            Some("account_number") => imports::Column::AccountNumber,
            Some("import_date") => imports::Column::ImportDate,
            Some("source_file_date") => imports::Column::SourceFileDate,
            None => imports::Column::ImportDate,
            _ => return Err(serde::de::Error::custom("Invalid column value")),
        };

        let direction = match helper.direction.as_deref() {
            Some("asc") => Order::Asc,
            Some("desc") => Order::Desc,
            None => Order::Asc,
            _ => return Err(serde::de::Error::custom("Invalid direction value")),
        };

        Ok(ImportSort { column, direction })
    }
}

#[derive(Default, Deserialize)]
pub struct ImportFilter {
    pub id: Option<Uuid>,
    pub account_number: Option<(StringFilterType, String)>,
    pub import_date: Option<(DateFilterType, DateTime)>,
    pub source_file_date: Option<(DateFilterType, DateTime)>,
}

#[derive(Default, Deserialize)]
pub struct ImportsQueryOptions {
    pub filter: Option<ImportFilter>,
    pub sort: Option<ImportSort>,
    pub limit: Option<u64>,
    pub offset: Option<u64>,
}
