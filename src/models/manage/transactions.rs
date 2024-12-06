use crate::models::entities::transactions;
use prelude::{DateTime, Decimal, Expr};
use sea_orm::{entity::*, query::*, DatabaseConnection};
use uuid::Uuid;

/// Insert multiple transactions into the database
///
/// # Arguments
/// * `db` - Database connection handle
/// * `transactions` - List of  transaction objects to be inserted
///
/// # Returns
/// * `Result<Vec<Uuid>, sea_orm::DbErr>` - List of  UUIDs of the created transactions or error
pub async fn create_transactions(
    db: &DatabaseConnection,
    transactions: Vec<transactions::ActiveModel>,
) -> Result<Vec<Uuid>, sea_orm::DbErr> {
    let mut inserted_ids: Vec<Uuid> = Vec::new();
    for transaction in transactions.iter() {
        inserted_ids.push(transaction.id.clone().unwrap());
    }

    transactions::Entity::insert_many(transactions)
        .exec(db)
        .await?;

    Ok(inserted_ids)
}

/// Update a transaction
///
/// # Arguments
/// * `db` - Database connection handle
/// * `id` - UUID of the transaction record
/// * `date` - Optional new date for the transaction
/// * `amount` - Optional new amount for the transaction
/// * `balance` - Optional new balance for the transaction
/// * `ref_no` - Optional new reference number for the transaction
/// * `description` - Optional new description for the transaction
/// * `sequence_number` - Optional new sequence number for the transaction
///
/// # Returns
/// * `Result<transactions::Model, sea_orm::DbErr>` - The updated transaction record or error
pub async fn update_transaction(
    db: &DatabaseConnection,
    id: Uuid,
    account_id: Option<Uuid>,
    amount: Option<Decimal>,
    balance: Option<Decimal>,
    date: Option<DateTime>,
    ref_no: Option<String>,
    description: Option<String>,
    sequence_number: Option<i64>,
) -> Result<transactions::Model, sea_orm::DbErr> {
    let mut transaction: transactions::ActiveModel = transactions::Entity::find_by_id(id)
        .one(db)
        .await?
        .ok_or(sea_orm::DbErr::RecordNotFound(
            "error.transactions.update_transaction.not_found".to_string(),
        ))?
        .into();

    if let Some(account_id) = account_id {
        transaction.account_id = Set(account_id);
    }

    if let Some(date) = date {
        transaction.date = Set(date);
    }
    if let Some(amount) = amount {
        transaction.amount = Set(amount);
    }
    if let Some(balance) = balance {
        transaction.balance = Set(balance);
    }
    if let Some(ref_no) = ref_no {
        transaction.ref_no = Set(ref_no);
    }
    if let Some(description) = description {
        transaction.description = Set(description);
    }
    if let Some(sequence_number) = sequence_number {
        transaction.sequence_number = Set(sequence_number);
    }

    let updated_transaction = transaction.update(db).await?;
    Ok(updated_transaction)
}

/// Delete a transaction by ID
///
/// # Arguments
/// * `db` - Database connection handle
/// * `id` - UUID of the transaction record to delete
///
/// # Returns
/// * `Result<(), sea_orm::DbErr>` - The result of the delete operation or error
pub async fn delete_transaction(db: &DatabaseConnection, id: Uuid) -> Result<(), sea_orm::DbErr> {
    let transaction = transactions::Entity::find_by_id(id).one(db).await?.ok_or(
        sea_orm::DbErr::RecordNotFound(
            "error.transactions.delete_transaction_by_id.not_found".to_string(),
        ),
    )?;

    let sequence_number = transaction.sequence_number;
    let account_id = transaction.account_id;

    transactions::Entity::delete_by_id(id).exec(db).await?;

    // Reduce the sequence number for all transactions with sequence number more than the deleted transaction
    transactions::Entity::update_many()
        .col_expr(
            transactions::Column::SequenceNumber,
            Expr::col(transactions::Column::SequenceNumber).sub(1),
        )
        .filter(transactions::Column::SequenceNumber.gt(sequence_number))
        .filter(transactions::Column::AccountId.eq(account_id))
        .exec(db)
        .await?;

    Ok(())
}
