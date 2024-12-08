use crate::models::{
    entities::transactions,
    helpers::{
        apply_date_filter, apply_number_filter, apply_string_filter,
        transactions::{TransactionFilter, TransactionSort, TransactionsQueryOptions},
        NumberFilterType,
    },
};
use prelude::DateTime;
use sea_orm::{entity::*, query::*, DatabaseConnection, DatabaseTransaction, DeleteResult};
use uuid::Uuid;

/// Insert a transaction into the database
///
/// # Arguments
/// * `db` - Database connection handle
/// * `transaction` - Transaction object to be inserted
///
/// # Returns
/// * `Result<Uuid, sea_orm::DbErr>` - UUID of the created transaction or error
pub async fn create_transaction(
    db: &DatabaseConnection,
    mut transaction: transactions::ActiveModel,
) -> Result<transactions::Model, sea_orm::DbErr> {
    let txn = db.begin().await?;
    let inserted_transaction_id = txn_create_transaction(&txn, &mut transaction).await?;
    txn.commit().await?;

    let inserted_transaction = get_transaction(
        db,
        TransactionsQueryOptions {
            filter: Some(TransactionFilter {
                id: Some(inserted_transaction_id),
                ..Default::default()
            }),
            ..Default::default()
        },
    )
    .await?
    .ok_or(sea_orm::DbErr::RecordNotFound(
        "error.staged_transactions.create_staged_transaction.not_found".to_string(),
    ))?;

    Ok(inserted_transaction)
}

pub(super) async fn txn_create_transaction(
    txn: &DatabaseTransaction,
    transaction: &mut transactions::ActiveModel,
) -> Result<Uuid, sea_orm::DbErr> {
    // Calculate the correct balance after current transaction
    transaction.balance = Set(build_query(TransactionsQueryOptions {
        filter: Some(TransactionFilter {
            account_id: Some(transaction.account_id.clone().unwrap()),
            sequence_number: Some((
                NumberFilterType::LessThan,
                transaction.sequence_number.clone().unwrap(),
            )),
            ..Default::default()
        }),
        ..Default::default()
    })
    .one(txn)
    .await?
    .map(|prev_txn| prev_txn.balance + transaction.amount.clone().unwrap())
    .unwrap_or_else(|| transaction.amount.clone().unwrap()));

    // Calculate the balance of the subsequent transactions
    let mut dependent_transactions = recalculate_balance(
        txn,
        transaction.account_id.clone().unwrap(),
        transaction.sequence_number.clone().unwrap() - 1,
        transaction.balance.clone().unwrap(),
    )
    .await?;

    let mut curr_sequence_number = transaction.sequence_number.clone().unwrap();
    for dependant in dependent_transactions.iter_mut() {
        let dependant_seq_number = dependant.sequence_number.clone().unwrap();
        // This means there is a gap in the sequence numbers, so we
        // don't need to add +1 to remaining transactions
        if dependant_seq_number != curr_sequence_number {
            break;
        }
        dependant.sequence_number = Set(dependant_seq_number + 1);
        curr_sequence_number += 1;
    }

    for dependant in dependent_transactions.iter_mut().rev() {
        dependant.clone().update(txn).await?;
    }

    let inserted_transaction_id = transactions::Entity::insert(transaction.clone())
        .exec(txn)
        .await?
        .last_insert_id;

    Ok(inserted_transaction_id)
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
    amount: Option<f32>,
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

    if let Some(sequence_number) = sequence_number {
        transaction.sequence_number = Set(sequence_number);
    }

    if let Some(account_id) = account_id {
        transaction.account_id = Set(account_id);
    }

    if let Some(date) = date {
        transaction.date = Set(date);
    }

    if let Some(amount) = amount {
        transaction.amount = Set(amount);
    }

    if let Some(ref_no) = ref_no {
        transaction.ref_no = Set(ref_no);
    }

    if let Some(description) = description {
        transaction.description = Set(description);
    }

    let txn = db.begin().await?;
    txn_delete_transaction(&txn, &transaction).await?;
    let updated_transaction_id = txn_create_transaction(&txn, &mut transaction).await?;

    txn.commit().await?;

    let updated_transaction = get_transaction(
        db,
        TransactionsQueryOptions {
            filter: Some(TransactionFilter {
                id: Some(updated_transaction_id),
                ..Default::default()
            }),
            ..Default::default()
        },
    )
    .await?
    .ok_or(sea_orm::DbErr::RecordNotFound(
        "error.transactions.update_transaction.not_found".to_string(),
    ))?;

    Ok(updated_transaction)
}

/// Delete a transaction by ID
///
/// # Arguments
/// * `db` - Database connection handle
/// * `id` - UUID of the transaction record to delete
///
/// # Returns
/// * `Result<DeleteResult, sea_orm::DbErr>` - The result of the delete operation or error
pub async fn delete_transaction(
    db: &DatabaseConnection,
    id: Uuid,
) -> Result<DeleteResult, sea_orm::DbErr> {
    let transaction = transactions::Entity::find_by_id(id)
        .one(db)
        .await?
        .ok_or_else(|| {
            sea_orm::DbErr::RecordNotFound(
                "error.transactions.delete_transaction_by_id.not_found".to_string(),
            )
        })?;

    let txn = db.begin().await?;
    let deleted_transaction =
        txn_delete_transaction(&txn, &transaction.into_active_model()).await?;
    txn.commit().await?;

    Ok(deleted_transaction)
}

pub(super) async fn txn_delete_transaction(
    txn: &DatabaseTransaction,
    transaction: &transactions::ActiveModel,
) -> Result<DeleteResult, sea_orm::DbErr> {
    let mut dependent_transactions = recalculate_balance(
        txn,
        transaction.account_id.clone().unwrap(),
        transaction.sequence_number.clone().unwrap(),
        transaction.balance.clone().unwrap() - transaction.amount.clone().unwrap(),
    )
    .await?;

    for transaction in dependent_transactions.iter_mut() {
        transaction.clone().update(txn).await?;
    }

    let deleted_transaction = transactions::Entity::delete_by_id(transaction.id.clone().unwrap())
        .exec(txn)
        .await?;

    Ok(deleted_transaction)
}

/// Get all transactions with filters, sorting, and pagination
///
/// # Arguments
/// * `db` - Database connection handle
/// * `options` - Query options including filters, sorting, and pagination
///
/// # Returns
/// * `Result<Vec<transactions::Model>, sea_orm::DbErr>` - List of transaction records or error
pub async fn get_transactions(
    db: &DatabaseConnection,
    options: TransactionsQueryOptions,
) -> Result<Vec<transactions::Model>, sea_orm::DbErr> {
    let query = build_query(options);
    let transactions_list = query.all(db).await?;
    Ok(transactions_list)
}

/// Get a transaction based on the provided filter
///
/// # Arguments
/// * `db` - Database connection handle
/// * `options` - TransactionsQueryOptions struct containing filter parameters
///
/// # Returns
/// * `Result<Option<transactions::Model>, sea_orm::DbErr>` - The transaction record or error
pub async fn get_transaction(
    db: &DatabaseConnection,
    options: TransactionsQueryOptions,
) -> Result<Option<transactions::Model>, sea_orm::DbErr> {
    if let Some(filter) = &options.filter {
        if let Some(id) = &filter.id {
            return transactions::Entity::find_by_id(id.clone()).one(db).await;
        }
    }

    let query = build_query(options);
    let transaction = query.one(db).await?;
    Ok(transaction)
}

/// Build a query for transactions with filters, sorting, and pagination
///
/// # Arguments
/// * `options` - Query options including filters, sorting, and pagination
///
/// # Returns
/// * `Select<transactions::Entity>` - The constructed query
fn build_query(options: TransactionsQueryOptions) -> Select<transactions::Entity> {
    let mut query = transactions::Entity::find();

    if let Some(filter) = options.filter {
        if let Some(id) = filter.id {
            query = query.filter(transactions::Column::Id.eq(id));
        }

        if let Some(account_id) = filter.account_id {
            query = query.filter(transactions::Column::AccountId.eq(account_id));
        }

        query = apply_number_filter(
            query,
            filter.sequence_number,
            transactions::Column::SequenceNumber,
        );
        query = apply_date_filter(query, filter.date, transactions::Column::Date);
        query = apply_number_filter(query, filter.amount, transactions::Column::Amount);
        query = apply_number_filter(query, filter.balance, transactions::Column::Balance);
        query = apply_string_filter(query, filter.ref_no, transactions::Column::RefNo);
        query = apply_string_filter(query, filter.description, transactions::Column::Description);
    }

    if let Some(limit) = options.limit {
        query = query.limit(limit);
    }

    if let Some(offset) = options.offset {
        query = query.offset(offset);
    }

    if let Some(sort) = options.sort {
        query = query.order_by(sort.column, sort.direction);
    }

    query
}

async fn recalculate_balance(
    txn: &DatabaseTransaction,
    account_id: Uuid,
    sequence_number: i64,
    mut current_balance: f32,
) -> Result<Vec<transactions::ActiveModel>, sea_orm::DbErr> {
    // Get all transactions with sequence number higher than the given transaction
    let query = build_query(TransactionsQueryOptions {
        filter: Some(TransactionFilter {
            account_id: Some(account_id),
            sequence_number: Some((NumberFilterType::GreaterThan, sequence_number)),
            ..Default::default()
        }),
        sort: Some(TransactionSort {
            column: transactions::Column::SequenceNumber,
            direction: Order::Asc,
        }),
        ..Default::default()
    });
    let mut transactions = query
        .all(txn)
        .await?
        .into_iter()
        .map(|transaction| transaction.into_active_model())
        .collect::<Vec<transactions::ActiveModel>>();

    // Recalculate balance for each transaction
    for transaction in transactions.iter_mut() {
        current_balance += transaction.amount.as_ref();
        transaction.balance = Set(current_balance);
    }

    Ok(transactions)
}
