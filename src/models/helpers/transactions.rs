use crate::models::{entities::transactions, helpers::SortDirection};
use sea_orm::prelude::{DateTime, Decimal};
use uuid::Uuid;

use super::{DateFilterType, NumberFilterType, StringFilterType};

pub struct TransactionSort {
    pub column: transactions::Column,
    pub direction: SortDirection,
}

#[derive(Default)]
pub struct TransactionFilter {
    pub id: Option<Uuid>,
    pub account_id: Option<Uuid>,
    pub sequence_number: Option<(NumberFilterType, i64)>,
    pub date: Option<(DateFilterType, DateTime)>,
    pub amount: Option<(NumberFilterType, Decimal)>,
    pub balance: Option<(NumberFilterType, Decimal)>,
    pub ref_no: Option<(StringFilterType, String)>,
    pub description: Option<(StringFilterType, String)>,
}

#[derive(Default)]
pub struct TransactionsQueryOptions {
    pub filter: Option<TransactionFilter>,
    pub sort: Option<TransactionSort>,
    pub limit: Option<u64>,
    pub offset: Option<u64>,
}
