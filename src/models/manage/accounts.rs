use crate::models::entities::{accounts, sea_orm_active_enums::AccountType};
use crate::models::helpers::{accounts::*, apply_string_filter};

use sea_orm::{entity::*, query::*, DatabaseConnection, DbErr, DeleteResult, Set};
use uuid::Uuid;

/// Creates a new account in the database
///
/// # Arguments
///
/// * `db` - Database connection
/// * `account_number` - The account number as a string
/// * `account_type` - The type of account (checking, savings, etc)
///
/// # Returns
///
/// * `Result<Uuid, DbErr>` - The UUID of the created account on success, or a database error on failure
pub async fn create_account(
    db: &DatabaseConnection,
    account_number: &str,
    account_type: &AccountType,
) -> Result<accounts::Model, DbErr> {
    let account = accounts::ActiveModel {
        id: Set(Uuid::new_v4()),
        account_number: Set(account_number.to_string()),
        r#type: Set(account_type.clone()),
        ..Default::default()
    };

    let result = accounts::Entity::insert(account).exec(db).await?;
    get_account(
        db,
        AccountsQueryOptions {
            filter: Some(AccountFilter {
                id: Some(result.last_insert_id),
                ..Default::default()
            }),
            ..Default::default()
        },
    )
    .await?
    .ok_or(DbErr::RecordNotFound(
        "error.fiscal_accounts.create_account.could_not_find".to_string(),
    ))
}

/// Update an account's type and/or account number
///
/// # Arguments
///
/// * `db` - Database connection
/// * `id` - UUID of the account to update
/// * `account_type` - Optional new account type
/// * `account_number` - Optional new account number
///
/// # Returns
///
/// * `Result<accounts::Model, DbErr>` - The updated account on success, or a database error on failure
pub async fn update_account(
    db: &DatabaseConnection,
    id: Uuid,
    account_type: Option<AccountType>,
    account_number: Option<String>,
) -> Result<accounts::Model, DbErr> {
    let mut account: accounts::ActiveModel = accounts::Entity::find_by_id(id)
        .one(db)
        .await?
        .ok_or(DbErr::RecordNotFound(
            "error.fiscal_accounts.update_account.not_found".to_string(),
        ))?
        .into();

    if let Some(new_type) = account_type {
        account.r#type = Set(new_type);
    }

    if let Some(new_number) = account_number {
        account.account_number = Set(new_number);
    }

    account.update(db).await
}

/// Delete an account by ID
///
/// # Arguments
///
/// * `db` - Database connection
/// * `id` - UUID of the account to delete
///
/// # Returns
///
/// * `Result<DeleteResult, DbErr>` - The result of the delete operation
pub async fn delete_account(db: &DatabaseConnection, id: Uuid) -> Result<DeleteResult, DbErr> {
    let delete_result = accounts::Entity::delete_by_id(id).exec(db).await?;

    if delete_result.rows_affected == 0 {
        return Err(DbErr::RecordNotFound(
            "error.fiscal_accounts.delete_account.not_found".to_string(),
        ));
    }

    Ok(delete_result)
}

pub(crate) async fn get_max_sequence(
    db: &DatabaseConnection,
    account_id: Uuid,
) -> Result<i64, DbErr> {
    let account = accounts::Entity::find_by_id(account_id)
        .one(db)
        .await?
        .ok_or(DbErr::RecordNotFound(
            "error.fiscal_accounts.get_max_sequence.not_found".to_string(),
        ))?;

    Ok(account.max_sequence_number)
}

/// Get all accounts based on the provided query options
///
/// # Arguments
///
/// * `db` - Database connection handle
/// * `options` - AccountsQueryOptions struct containing filter, sort, limit, and offset parameters
///
/// # Returns
///
/// * `Result<Vec<accounts::Model>, DbErr>` - List of account records or error
pub async fn get_accounts(
    db: &DatabaseConnection,
    options: AccountsQueryOptions,
) -> Result<Vec<accounts::Model>, DbErr> {
    let query = build_query(options);
    let accounts_list = query.all(db).await?;
    Ok(accounts_list)
}

/// Get an account based on the provided filter
///
/// # Arguments
///
/// * `db` - Database connection handle
/// * `options` - AccountsQueryOptions struct containing filter parameters
///
/// # Returns
///
/// * `Result<Option<accounts::Model>, DbErr>` - The account record or error
pub async fn get_account(
    db: &DatabaseConnection,
    options: AccountsQueryOptions,
) -> Result<Option<accounts::Model>, DbErr> {
    if let Some(filter) = &options.filter {
        if let Some(id) = &filter.id {
            return accounts::Entity::find_by_id(id.clone()).one(db).await;
        }
    }

    let query = build_query(options);
    let account = query.one(db).await?;
    Ok(account)
}

// Helps in Building queries
// by adding all the provided filters, sort, limit and offset
fn build_query(options: AccountsQueryOptions) -> Select<accounts::Entity> {
    let mut query = accounts::Entity::find();

    // Apply filters if present
    if let Some(filter) = options.filter {
        if let Some(id) = filter.id {
            query = query.filter(accounts::Column::Id.eq(id));
        }

        if let Some((filter_type, value)) = filter.account_number {
            query = apply_string_filter(
                query,
                Some((filter_type, value)),
                accounts::Column::AccountNumber,
            );
        }

        if let Some(account_type) = filter.r#type {
            query = query.filter(accounts::Column::Type.eq(account_type));
        }
    }

    // Apply sorting if present
    if let Some(sort) = options.sort {
        query = query.order_by(sort.column, sort.direction);
    }

    // Apply pagination if present
    if let Some(limit) = options.limit {
        query = query.limit(limit);
    }

    if let Some(offset) = options.offset {
        query = query.offset(offset);
    }

    query
}
