use super::{
    staged_transactions::txn_create_staged_transaction, transactions::txn_create_transaction,
};
use crate::{
    models::{
        entities::{imports, transactions},
        helpers::{
            imports::*,
            staged_transactions::{
                build_staged_transaction, StagedTransactionFilter, StagedTransactionsQueryOptions,
            },
            *,
        },
        manage::{accounts::get_max_sequence, staged_transactions::get_staged_transactions},
    },
    readers::parsers::types::Statement,
    utils::datetime::get_current_naive_datetime,
};
use prelude::Decimal;
use sea_orm::{entity::*, query::*, ActiveValue::Set, DatabaseConnection, DbErr, DeleteResult};
use uuid::Uuid;

/// Put statement object in database
///
/// # Arguments
/// * `db` - Database connection handle
/// * `statement` - Statement object containing account and transaction data
///
/// # Returns
/// * `Result<Uuid, DbErr>` - ID of the created import staging record or error
pub async fn create_import(db: &DatabaseConnection, statement: &Statement) -> Result<Uuid, DbErr> {
    // Create transaction staging record
    let import = imports::ActiveModel {
        id: Set(Uuid::new_v4()),
        account_number: Set(statement.account_number.clone()),
        import_date: Set(get_current_naive_datetime()),
        source_file_date: Set(statement.date.naive_utc()),
        ..Default::default()
    };

    let import_id = imports::Entity::insert(import)
        .exec(db)
        .await?
        .last_insert_id;

    let mut sequence_number = 0;
    let txn = db.begin().await?;
    for transaction in statement.transactions.iter() {
        let amount = if transaction.deposit > Decimal::ZERO {
            transaction.deposit
        } else {
            -transaction.withdrawal
        };
        sequence_number += 1;
        let staged_transaction = build_staged_transaction(
            amount,
            import_id,
            transaction.date.naive_utc(),
            transaction.balance,
            sequence_number,
            transaction.ref_no.clone(),
            transaction.description.clone(),
        );
        txn_create_staged_transaction(&txn, &staged_transaction).await?;
    }
    txn.commit().await?;
    Ok(import_id)
}

/// Update an import's account number
///
/// # Arguments
///
/// * `db` - Database connection handle
/// * `id` - UUID of the import to update
/// * `account_number` - Optional new account number
///
/// # Returns
///
/// * `Result<imports::Model, DbErr>` - The updated import on success, or a database error on failure
pub async fn update_import(
    db: &DatabaseConnection,
    id: Uuid,
    account_number: Option<String>,
) -> Result<imports::Model, DbErr> {
    let mut import: imports::ActiveModel = imports::Entity::find_by_id(id)
        .one(db)
        .await?
        .ok_or(DbErr::RecordNotFound(
            "error.imports.update_import.not_found".to_string(),
        ))?
        .into();

    if let Some(new_account_number) = account_number {
        import.account_number = Set(new_account_number);
    }

    import.update(db).await
}

/// Delete an import by ID
///
/// # Arguments
///
/// * `db` - Database connection handle
/// * `id` - UUID of the import record to delete
///
/// # Returns
///
/// * `Result<DeleteResult, DbErr>` - The result of the delete operation or error
pub async fn delete_import(db: &DatabaseConnection, id: Uuid) -> Result<DeleteResult, DbErr> {
    let delete_result = imports::Entity::delete_by_id(id).exec(db).await?;

    if delete_result.rows_affected == 0 {
        return Err(DbErr::RecordNotFound(
            "error.imports.delete_import.not_found".to_string(),
        ));
    }

    Ok(delete_result)
}

/// Approve an import by ID
///
/// This function promotes staged transactions associated with a given import ID to actual transactions
/// and assigns them to a specified account. It also deletes the import record after the transactions
/// have been successfully created.
///
/// # Arguments
///
/// * `db` - Database connection handle
/// * `id` - UUID of the import record to approve
/// * `account_id` - UUID of the account to which the transactions will be assigned
///
/// # Returns
///
/// * `Result<(), DbErr>` - An empty result or an error
///
/// # Steps
///
/// 1. Retrieve all staged transactions associated with the import ID.
/// 2. Get the maximum sequence number for the specified account ID.
/// 3. Promote staged transactions to actual transactions, adjusting their sequence numbers.
/// 4. Add the new transactions to the account's records.
/// 5. Delete the import record by its ID.
pub async fn approve_import(
    db: &DatabaseConnection,
    id: Uuid,
    account_id: Uuid,
) -> Result<(), DbErr> {
    // 1. Get all the staged transactions for this import
    let staged_transactions = get_staged_transactions(
        db,
        StagedTransactionsQueryOptions {
            filter: Some(StagedTransactionFilter {
                import_id: Some(id),
                ..Default::default()
            }),
            ..Default::default()
        },
    )
    .await?;

    // 2. Get the maxSequenceNumber for the account_id
    let max_sequence_number = match get_max_sequence(db, account_id).await {
        Ok(seq) => seq,
        Err(DbErr::RecordNotFound(_)) => {
            return Err(DbErr::RecordNotFound(
                "error.import.account_not_found".to_string(),
            ));
        }
        Err(e) => return Err(e),
    };

    // 3. Promote staged_transactions to transaction with seq_id to maxSequenceId + seq_id of staged Transaction
    let mut new_transactions: Vec<transactions::ActiveModel> = staged_transactions
        .into_iter()
        .map(|staged_transaction| {
            let new_sequence_number = max_sequence_number + staged_transaction.sequence_number;
            transactions::ActiveModel {
                id: Set(Uuid::new_v4()),
                account_id: Set(account_id),
                date: Set(staged_transaction.date),
                amount: Set(staged_transaction.amount),
                balance: Set(staged_transaction.balance),
                ref_no: Set(staged_transaction.ref_no.clone()),
                description: Set(staged_transaction.description.clone()),
                sequence_number: Set(new_sequence_number),
                ..Default::default()
            }
        })
        .collect();

    // 4. Add transactions to the account's records
    let txn = db.begin().await?;
    for transaction in new_transactions.iter_mut() {
        txn_create_transaction(&txn, transaction).await?;
    }
    txn.commit().await?;

    // 5. Delete the import by id
    delete_import(db, id).await?;

    Ok(())
}

/// Get imports with query options
///
/// This function retrieves a list of imports from the database with filtering, sorting and pagination support.
///
/// # Arguments
///
/// * `db` - Database connection handle
/// * `options` - Query options including filters, sort, limit and offset
///
/// # Returns
///
/// * `Result<Vec<imports::Model>, DbErr>` - A vector of import models or an error
pub async fn get_imports(
    db: &DatabaseConnection,
    options: ImportsQueryOptions,
) -> Result<Vec<imports::Model>, DbErr> {
    let query = build_query(options);
    let imports = query.all(db).await?;
    Ok(imports)
}

/// Get an import based on the provided filter
///
/// # Arguments
///
/// * `db` - Database connection handle
/// * `options` - ImportsQueryOptions struct containing filter parameters
///
/// # Returns
///
/// * `Result<Option<imports::Model>, DbErr>` - The import record or error
pub async fn get_import(
    db: &DatabaseConnection,
    options: ImportsQueryOptions,
) -> Result<Option<imports::Model>, DbErr> {
    if let Some(filter) = &options.filter {
        if let Some(id) = &filter.id {
            return imports::Entity::find_by_id(id.clone()).one(db).await;
        }
    }

    let query = build_query(options);
    let import = query.one(db).await?;
    Ok(import)
}

fn build_query(options: ImportsQueryOptions) -> Select<imports::Entity> {
    let mut query = imports::Entity::find();

    if let Some(filter) = options.filter {
        if let Some(id) = filter.id {
            query = query.filter(imports::Column::Id.eq(id));
        }

        if let Some(account_number) = filter.account_number {
            query =
                apply_string_filter(query, Some(account_number), imports::Column::AccountNumber);
        }

        query = apply_date_filter(query, filter.import_date, imports::Column::ImportDate);
        query = apply_date_filter(
            query,
            filter.source_file_date,
            imports::Column::SourceFileDate,
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

    query
}
