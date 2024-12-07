use crate::models::{
    entities::transactions,
    helpers::{
        apply_date_filter, apply_number_filter, apply_string_filter,
        transactions::{TransactionFilter, TransactionSort, TransactionsQueryOptions},
        NumberFilterType, SortDirection,
    },
};
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
        match sort.direction {
            SortDirection::Asc => query = query.order_by_asc(sort.column),
            SortDirection::Desc => query = query.order_by_desc(sort.column),
        }
    }

    query
}

async fn recalculate_balance(
    db: &DatabaseConnection,
    starting_transaction: &transactions::ActiveModel,
) -> Result<Vec<transactions::ActiveModel>, sea_orm::DbErr> {
    let account_id = starting_transaction.account_id.clone().unwrap();
    let sequence_number = starting_transaction.sequence_number.clone().unwrap();

    // Get all transactions with sequence number higher than the given transaction
    let mut transactions = get_transactions(
        db,
        TransactionsQueryOptions {
            filter: Some(TransactionFilter {
                account_id: Some(account_id),
                sequence_number: Some((NumberFilterType::GreaterThan, sequence_number)),
                ..Default::default()
            }),
            sort: Some(TransactionSort {
                column: transactions::Column::SequenceNumber,
                direction: SortDirection::Asc,
            }),
            ..Default::default()
        },
    )
    .await?
    .into_iter()
    .map(|transaction| transaction.into_active_model())
    .collect::<Vec<transactions::ActiveModel>>();

    // Recalculate balance for each transaction
    let mut current_balance = starting_transaction.balance.clone().unwrap();
    for transaction in transactions.iter_mut() {
        current_balance += transaction.amount.as_ref();
        transaction.balance = Set(current_balance);
    }

    Ok(transactions)
}
