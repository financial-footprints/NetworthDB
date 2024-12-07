use crate::models::{entities::staged_transactions, helpers::SortDirection};
use prelude::DateTime;
use sea_orm::{entity::*, prelude::Decimal, ActiveValue::Set};
use uuid::Uuid;

use super::{DateFilterType, NumberFilterType, StringFilterType};

/// Build a new staged transaction ActiveModel
///
/// # Arguments
///
/// * `amount` - The amount of the transaction
/// * `import_id` - The UUID of the import record
/// * `date` - The date of the transaction
/// * `balance` - The balance after the transaction
/// * `sequence_number` - The sequence number of the transaction
/// * `ref_no` - The reference number of the transaction
/// * `description` - The description of the transaction
///
/// # Returns
///
/// * `staged_transactions::ActiveModel` - The constructed ActiveModel for the staged transaction
pub fn build_staged_transaction(
    amount: Decimal,
    import_id: Uuid,
    date: DateTime,
    balance: Decimal,
    sequence_number: i64,
    ref_no: String,
    description: String,
) -> staged_transactions::ActiveModel {
    staged_transactions::ActiveModel {
        id: Set(Uuid::new_v4()),
        amount: Set(amount),
        import_id: Set(import_id),
        date: Set(date),
        balance: Set(balance),
        sequence_number: Set(sequence_number),
        ref_no: Set(ref_no),
        description: Set(description),
        ..Default::default()
    }
}

pub struct StagedTransactionSort {
    pub column: staged_transactions::Column,
    pub direction: SortDirection,
}

#[derive(Default)]
pub struct StagedTransactionFilter {
    pub id: Option<Uuid>,
    pub import_id: Option<Uuid>,
    pub sequence_number: Option<(NumberFilterType, i64)>,
    pub date: Option<(DateFilterType, DateTime)>,
    pub amount: Option<(NumberFilterType, Decimal)>,
    pub balance: Option<(NumberFilterType, Decimal)>,
    pub ref_no: Option<(StringFilterType, String)>,
    pub description: Option<(StringFilterType, String)>,
}

#[derive(Default)]
pub struct StagedTransactionsQueryOptions {
    pub filter: Option<StagedTransactionFilter>,
    pub sort: Option<StagedTransactionSort>,
    pub limit: Option<u64>,
    pub offset: Option<u64>,
}
