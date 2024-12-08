use crate::models::entities::staged_transactions;
use prelude::DateTime;
use sea_orm::{entity::*, prelude::Decimal, ActiveValue::Set, Order};
use serde::Deserialize;
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

#[derive(Debug)]
pub struct StagedTransactionSort {
    pub column: staged_transactions::Column,
    pub direction: Order,
}

impl Default for StagedTransactionSort {
    fn default() -> Self {
        StagedTransactionSort {
            column: staged_transactions::Column::SequenceNumber,
            direction: Order::Desc,
        }
    }
}

impl<'de> Deserialize<'de> for StagedTransactionSort {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        #[derive(Deserialize)]
        struct StagedTransactionSortHelper {
            column: Option<String>,
            direction: Option<String>,
        }

        let helper = StagedTransactionSortHelper::deserialize(deserializer)?;

        let column = match helper.column.as_deref() {
            Some("id") => staged_transactions::Column::Id,
            Some("import_id") => staged_transactions::Column::ImportId,
            Some("sequence_number") => staged_transactions::Column::SequenceNumber,
            Some("date") => staged_transactions::Column::Date,
            Some("amount") => staged_transactions::Column::Amount,
            Some("balance") => staged_transactions::Column::Balance,
            Some("ref_no") => staged_transactions::Column::RefNo,
            Some("description") => staged_transactions::Column::Description,
            None => staged_transactions::Column::SequenceNumber,
            _ => return Err(serde::de::Error::custom("Invalid column value")),
        };

        let direction = match helper.direction.as_deref() {
            Some("asc") => Order::Asc,
            Some("desc") => Order::Desc,
            None => Order::Desc,
            _ => return Err(serde::de::Error::custom("Invalid direction value")),
        };

        Ok(StagedTransactionSort { column, direction })
    }
}

#[derive(Debug, Default, Deserialize)]
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

#[derive(Debug, Default, Deserialize)]
pub struct StagedTransactionsQueryOptions {
    pub filter: Option<StagedTransactionFilter>,
    pub sort: Option<StagedTransactionSort>,
    pub limit: Option<u64>,
    pub offset: Option<u64>,
}
