use crate::models::{
    entities::staged_transactions,
    helpers::{staged_transactions::*, *},
};
use prelude::{DateTime, Expr};
use sea_orm::{
    entity::*, prelude::Decimal, query::*, ActiveValue::Set, DatabaseConnection, DeleteResult,
};
use uuid::Uuid;

/// Insert multiple staging transactions into the database
///
/// # Arguments
/// * `db` - Database connection handle
/// * `transactions` - List of  transaction objects to be inserted
///
/// # Returns
/// * `Result<Vec<Uuid>, sea_orm::DbErr>` - List of  UUIDs of the created transactions or error
pub async fn create_staged_transactions(
    db: &DatabaseConnection,
    transactions: Vec<staged_transactions::ActiveModel>,
) -> Result<Vec<Uuid>, sea_orm::DbErr> {
    let mut inserted_ids: Vec<Uuid> = Vec::new();
    for transaction in transactions.iter() {
        inserted_ids.push(transaction.id.clone().unwrap());
    }

    staged_transactions::Entity::insert_many(transactions)
        .exec(db)
        .await?;

    Ok(inserted_ids)
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
    let mut transaction: staged_transactions::ActiveModel =
        staged_transactions::Entity::find_by_id(id)
            .one(db)
            .await?
            .ok_or(sea_orm::DbErr::RecordNotFound(
                "error.staged_transactions.update_staged_transaction.not_found".to_string(),
            ))?
            .into();

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

    if let Some(new_sequence_number) = sequence_number {
        transaction.sequence_number = Set(new_sequence_number);
    }

    let mut dependent_transactions = match balance {
        Some(_) => recalculate_balance(db, &transaction).await?,
        None => Vec::new(),
    };

    // Update all dependent transactions in an atomic transaction
    let txn = db.begin().await?;
    for transaction in dependent_transactions.iter_mut() {
        transaction.clone().update(&txn).await?;
    }
    let updated_transaction = transaction.update(&txn).await?;
    txn.commit().await?;

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
        .ok_or(sea_orm::DbErr::RecordNotFound(
            "error.staged_transactions.delete_staged_transaction_by_id.not_found".to_string(),
        ))?;

    let sequence_number = transaction.sequence_number;
    let import_id = transaction.import_id;

    let deleted_transaction = staged_transactions::Entity::delete_by_id(id)
        .exec(db)
        .await?;

    // Reduce the sequence number for all staged transactions with sequence number more than the deleted transaction
    staged_transactions::Entity::update_many()
        .col_expr(
            staged_transactions::Column::SequenceNumber,
            Expr::col(staged_transactions::Column::SequenceNumber).sub(1),
        )
        .filter(staged_transactions::Column::SequenceNumber.gt(sequence_number))
        .filter(staged_transactions::Column::ImportId.eq(import_id))
        .exec(db)
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

async fn recalculate_balance(
    db: &DatabaseConnection,
    starting_transaction: &staged_transactions::ActiveModel,
) -> Result<Vec<staged_transactions::ActiveModel>, sea_orm::DbErr> {
    let import_id = starting_transaction.import_id.clone().unwrap();
    let sequence_number = starting_transaction.sequence_number.clone().unwrap();

    // Get all transactions with sequence number higher than the given transaction
    let mut transactions = get_staged_transactions(
        db,
        StagedTransactionsQueryOptions {
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
        },
    )
    .await?
    .into_iter()
    .map(|transaction| transaction.into_active_model())
    .collect::<Vec<staged_transactions::ActiveModel>>();

    // Recalculate balance for each transaction
    let mut current_balance = starting_transaction.balance.clone().unwrap();
    for transaction in transactions.iter_mut() {
        current_balance += transaction.amount.as_ref();
        transaction.balance = Set(current_balance);
    }

    Ok(transactions)
}
