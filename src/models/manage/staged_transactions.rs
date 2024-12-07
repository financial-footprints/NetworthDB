use crate::models::{
    entities::staged_transactions,
    helpers::{staged_transactions::*, *},
};
use prelude::DateTime;
use sea_orm::{
    entity::*, prelude::Decimal, query::*, ActiveValue::Set, DatabaseConnection,
    DatabaseTransaction, DeleteResult,
};
use uuid::Uuid;

/// Insert staging transaction into the database
///
/// # Arguments
/// * `db` - Database connection handle
/// * `transaction` - Staging transaction object to be inserted
///
/// # Returns
/// * `Result<staged_transactions::Model, sea_orm::DbErr>` - The created staging transaction or error
pub async fn create_staged_transaction(
    db: &DatabaseConnection,
    transaction: staged_transactions::ActiveModel,
) -> Result<staged_transactions::Model, sea_orm::DbErr> {
    let txn = db.begin().await?;
    let inserted_transaction_id = txn_create_staged_transaction(&txn, &transaction).await?;
    txn.commit().await?;

    let inserted_transaction = get_staged_transaction(
        db,
        StagedTransactionsQueryOptions {
            filter: Some(StagedTransactionFilter {
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

pub(super) async fn txn_create_staged_transaction(
    txn: &DatabaseTransaction,
    transaction: &staged_transactions::ActiveModel,
) -> Result<Uuid, sea_orm::DbErr> {
    let mut dependent_transactions = recalculate_balance(
        txn,
        transaction.import_id.clone().unwrap(),
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

    let inserted_transaction_id = staged_transactions::Entity::insert(transaction.clone())
        .exec(txn)
        .await?
        .last_insert_id;

    Ok(inserted_transaction_id)
}

/// Update a staged transaction
///
/// # Arguments
/// * `db` - Database connection handle
/// * `id` - UUID of the staged transaction record
/// * `date` - Optional new date for the transaction
/// * `amount` - Optional new amount for the transaction
/// * `balance` - Optional new balance for the transaction
/// * `ref_no` - Optional new reference number for the transaction
/// * `description` - Optional new description for the transaction
/// * `sequence_number` - Optional new sequence number for the transaction
///
/// # Returns
/// * `Result<staged_transactions::Model, sea_orm::DbErr>` - The updated staged transaction record or error
pub async fn update_staged_transaction(
    db: &DatabaseConnection,
    id: Uuid,
    date: Option<DateTime>,
    amount: Option<Decimal>,
    balance: Option<Decimal>,
    ref_no: Option<String>,
    description: Option<String>,
    sequence_number: Option<i64>,
) -> Result<staged_transactions::Model, sea_orm::DbErr> {
    let mut transaction = staged_transactions::Entity::find_by_id(id)
        .one(db)
        .await?
        .ok_or(sea_orm::DbErr::RecordNotFound(
            "error.staged_transactions.update_staged_transaction.not_found".to_string(),
        ))?
        .into_active_model();
    let mut lowest_sequence_number = transaction.sequence_number.clone().unwrap();

    if let Some(new_sequence_number) = sequence_number {
        transaction.sequence_number = Set(new_sequence_number);
        if new_sequence_number < lowest_sequence_number {
            lowest_sequence_number = new_sequence_number;
        }
    }
    if let Some(new_date) = date {
        transaction.date = Set(new_date);
    }

    if let Some(new_amount) = amount {
        transaction.amount = Set(new_amount);
    }

    if let Some(new_balance) = balance {
        transaction.balance = Set(new_balance);
    }

    if let Some(new_ref_no) = ref_no {
        transaction.ref_no = Set(new_ref_no);
    }

    if let Some(new_description) = description {
        transaction.description = Set(new_description);
    }

    // Update all dependent transactions in an atomic transaction
    let txn = db.begin().await?;
    txn_delete_staged_transaction(&txn, &transaction).await?;
    let updated_transaction_id = txn_create_staged_transaction(&txn, &transaction).await?;

    // Rebalance from the smallest available affected sequence number
    if sequence_number.is_some() {
        let query = build_query(StagedTransactionsQueryOptions {
            filter: Some(StagedTransactionFilter {
                import_id: Some(transaction.import_id.clone().unwrap()),
                sequence_number: Some((
                    NumberFilterType::EqualOrGreaterThan,
                    lowest_sequence_number,
                )),
                ..Default::default()
            }),
            ..Default::default()
        });
        let next_transaction = query.one(db).await?;
        if let Some(next_transaction) = next_transaction {
            let mut dependent_transactions = recalculate_balance(
                &txn,
                next_transaction.import_id,
                lowest_sequence_number,
                next_transaction.balance,
            )
            .await?;
            for transaction in dependent_transactions.iter_mut() {
                transaction.clone().update(&txn).await?;
            }
        }
    }

    txn.commit().await?;

    let updated_transaction = get_staged_transaction(
        db,
        StagedTransactionsQueryOptions {
            filter: Some(StagedTransactionFilter {
                id: Some(updated_transaction_id),
                ..Default::default()
            }),
            ..Default::default()
        },
    )
    .await?
    .ok_or(sea_orm::DbErr::RecordNotFound(
        "error.staged_transactions.update_staged_transaction.not_found".to_string(),
    ))?;

    Ok(updated_transaction)
}

/// Delete a staged transaction by ID
///
/// # Arguments
/// * `db` - Database connection handle
/// * `id` - UUID of the staged transaction record
///
/// # Returns
/// * `Result<DeleteResult, sea_orm::DbErr>` - The result of the delete operation or error
pub async fn delete_staged_transaction(
    db: &DatabaseConnection,
    id: Uuid,
) -> Result<DeleteResult, sea_orm::DbErr> {
    let transaction = staged_transactions::Entity::find_by_id(id)
        .one(db)
        .await?
        .ok_or_else(|| {
            sea_orm::DbErr::RecordNotFound(
                "error.staged_transactions.delete_staged_transaction_by_id.not_found".to_string(),
            )
        })?;

    let txn = db.begin().await?;
    let deleted_transaction =
        txn_delete_staged_transaction(&txn, &transaction.into_active_model()).await?;
    txn.commit().await?;

    Ok(deleted_transaction)
}

pub(super) async fn txn_delete_staged_transaction(
    txn: &DatabaseTransaction,
    transaction: &staged_transactions::ActiveModel,
) -> Result<DeleteResult, sea_orm::DbErr> {
    let mut dependent_transactions = recalculate_balance(
        txn,
        transaction.import_id.clone().unwrap(),
        transaction.sequence_number.clone().unwrap(),
        transaction.balance.clone().unwrap() - transaction.amount.clone().unwrap(),
    )
    .await?;

    for transaction in dependent_transactions.iter_mut() {
        transaction.clone().update(txn).await?;
    }

    let deleted_transaction =
        staged_transactions::Entity::delete_by_id(transaction.id.clone().unwrap())
            .exec(txn)
            .await?;

    Ok(deleted_transaction)
}

/// Get all staged transactions by import ID with limit and offset, with an optional sequence number filter
///
/// # Arguments
/// * `db` - Database connection handle
/// * `filter` - StagedTransactionFilter struct containing filter parameters
///
/// # Returns
/// * `Result<Vec<staged_transactions::Model>, sea_orm::DbErr>` - List of staged transaction records or error
pub async fn get_staged_transactions(
    db: &DatabaseConnection,
    options: StagedTransactionsQueryOptions,
) -> Result<Vec<staged_transactions::Model>, sea_orm::DbErr> {
    let query = build_query(options);
    let transactions_list = query.all(db).await?;
    Ok(transactions_list)
}

/// Get a staged transaction based on the provided filter
///
/// # Arguments
/// * `db` - Database connection handle
/// * `filter` - StagedTransactionFilter struct containing filter parameters
///
/// # Returns
/// * `Result<Option<staged_transactions::Model>, sea_orm::DbErr>` - The staged transaction record or error
pub async fn get_staged_transaction(
    db: &DatabaseConnection,
    options: StagedTransactionsQueryOptions,
) -> Result<Option<staged_transactions::Model>, sea_orm::DbErr> {
    if let Some(filter) = &options.filter {
        if let Some(id) = &filter.id {
            return staged_transactions::Entity::find_by_id(id.clone())
                .one(db)
                .await;
        }
    }

    let query = build_query(options);
    let transaction = query.one(db).await?;
    Ok(transaction)
}

// Helps in Building queries
// by adding all the provided filters, sort, limit and offset
fn build_query(options: StagedTransactionsQueryOptions) -> Select<staged_transactions::Entity> {
    let mut query = staged_transactions::Entity::find();

    if let Some(filter) = options.filter {
        if let Some(id) = filter.id {
            query = query.filter(staged_transactions::Column::Id.eq(id));
        }

        if let Some(import_id) = filter.import_id {
            query = query.filter(staged_transactions::Column::ImportId.eq(import_id));
        }

        query = apply_number_filter(
            query,
            filter.sequence_number,
            staged_transactions::Column::SequenceNumber,
        );
        query = apply_date_filter(query, filter.date, staged_transactions::Column::Date);
        query = apply_number_filter(query, filter.amount, staged_transactions::Column::Amount);
        query = apply_number_filter(query, filter.balance, staged_transactions::Column::Balance);
        query = apply_string_filter(query, filter.ref_no, staged_transactions::Column::RefNo);
        query = apply_string_filter(
            query,
            filter.description,
            staged_transactions::Column::Description,
        );
    }

    if let Some(limit) = options.limit {
        query = query.limit(limit);
    }

    if let Some(offset) = options.offset {
        query = query.offset(offset);
    }

    if let Some(sort) = options.sort {
        match sort.direction {
            SortDirection::Asc => query = query.order_by_asc(sort.column),
            SortDirection::Desc => query = query.order_by_desc(sort.column),
        }
    }

    return query;
}

/// Recalculate the balance for all staged transactions with a higher sequence number
async fn recalculate_balance(
    txn: &DatabaseTransaction,
    import_id: Uuid,
    sequence_number: i64,
    mut current_balance: Decimal,
) -> Result<Vec<staged_transactions::ActiveModel>, sea_orm::DbErr> {
    // Get all transactions with sequence number higher than the given transaction
    let query = build_query(StagedTransactionsQueryOptions {
        filter: Some(StagedTransactionFilter {
            import_id: Some(import_id),
            sequence_number: Some((NumberFilterType::GreaterThan, sequence_number)),
            ..Default::default()
        }),
        sort: Some(StagedTransactionSort {
            column: staged_transactions::Column::SequenceNumber,
            direction: SortDirection::Asc,
        }),
        ..Default::default()
    });
    let mut transactions = query
        .all(txn)
        .await?
        .into_iter()
        .map(|transaction| transaction.into_active_model())
        .collect::<Vec<staged_transactions::ActiveModel>>();

    // Recalculate balance for each transaction
    for transaction in transactions.iter_mut() {
        current_balance += transaction.amount.as_ref();
        transaction.balance = Set(current_balance);
    }

    Ok(transactions)
}
