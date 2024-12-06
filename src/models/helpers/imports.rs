use crate::models::{entities::imports, helpers::SortDirection};
use sea_orm::prelude::DateTime;
use uuid::Uuid;

use super::{DateFilterType, StringFilterType};

pub struct ImportSort {
    pub column: imports::Column,
    pub direction: SortDirection,
}

#[derive(Default)]
pub struct ImportFilter {
    pub id: Option<Uuid>,
    pub account_number: Option<(StringFilterType, String)>,
    pub import_date: Option<(DateFilterType, DateTime)>,
    pub source_file_date: Option<(DateFilterType, DateTime)>,
}

#[derive(Default)]
pub struct ImportsQueryOptions {
    pub filter: Option<ImportFilter>,
    pub sort: Option<ImportSort>,
    pub limit: Option<u64>,
    pub offset: Option<u64>,
}
