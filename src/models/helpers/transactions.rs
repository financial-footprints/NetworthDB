use super::{DateFilterType, NumberFilterType, StringFilterType};
use crate::models::entities::transactions;
use sea_orm::{
    prelude::{DateTime, Decimal},
    Order, Set,
};
use serde::Deserialize;
use uuid::Uuid;

/// Build a new staged transaction ActiveModel
///
/// # Arguments
///
/// * `amount` - The amount of the transaction
/// * `account_id` - The UUID of the account
/// * `date` - The date of the transaction
/// * `sequence_number` - The sequence number of the transaction
/// * `ref_no` - The reference number of the transaction
/// * `description` - The description of the transaction
///
/// # Returns
///
/// * `staged_transactions::ActiveModel` - The constructed ActiveModel for the staged transaction
pub fn build_transaction(
    amount: f32,
    account_id: Uuid,
    date: DateTime,
    sequence_number: i64,
    ref_no: String,
    description: String,
) -> transactions::ActiveModel {
    transactions::ActiveModel {
        id: Set(Uuid::new_v4()),
        amount: Set(amount),
        account_id: Set(account_id),
        date: Set(date),
        balance: Set(0.0),
        sequence_number: Set(sequence_number),
        ref_no: Set(ref_no),
        description: Set(description),
        ..Default::default()
    }
}

pub struct TransactionSort {
    pub column: transactions::Column,
    pub direction: Order,
}

impl Default for TransactionSort {
    fn default() -> Self {
        TransactionSort {
            column: transactions::Column::SequenceNumber,
            direction: Order::Desc,
        }
    }
}

impl<'de> Deserialize<'de> for TransactionSort {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        #[derive(Deserialize)]
        struct TransactionSortHelper {
            column: Option<String>,
            direction: Option<String>,
        }

        let helper = TransactionSortHelper::deserialize(deserializer)?;

        let column = match helper.column.as_deref() {
            Some("id") => transactions::Column::Id,
            Some("account_id") => transactions::Column::AccountId,
            Some("sequence_number") => transactions::Column::SequenceNumber,
            Some("date") => transactions::Column::Date,
            Some("amount") => transactions::Column::Amount,
            Some("balance") => transactions::Column::Balance,
            Some("ref_no") => transactions::Column::RefNo,
            Some("description") => transactions::Column::Description,
            None => transactions::Column::SequenceNumber,
            _ => return Err(serde::de::Error::custom("Invalid column value")),
        };

        let direction = match helper.direction.as_deref() {
            Some("asc") => Order::Asc,
            Some("desc") => Order::Desc,
            None => Order::Desc,
            _ => return Err(serde::de::Error::custom("Invalid direction value")),
        };

        Ok(TransactionSort { column, direction })
    }
}

#[derive(Default, Deserialize)]
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

#[derive(Default, Deserialize)]
pub struct TransactionsQueryOptions {
    pub filter: Option<TransactionFilter>,
    pub sort: Option<TransactionSort>,
    pub limit: Option<u64>,
    pub offset: Option<u64>,
}
