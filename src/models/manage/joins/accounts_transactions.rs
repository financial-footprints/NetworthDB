use crate::models::{
    entities::accounts,
    helpers::accounts::AccountsQueryOptions,
    manage::accounts::{get_account, get_accounts},
};
use sea_orm::{query::*, DatabaseConnection, DbBackend, DbErr};
use uuid::Uuid;

/// Retrieves a list of accounts along with their balances based on the provided query options.
///
/// # Arguments
///
/// * `db` - A reference to the database connection.
/// * `options` - An `AccountsQueryOptions` struct containing filter parameters.
///
/// # Returns
///
/// * `Result<Vec<(accounts::Model, f32)>, DbErr>` - A vector of tuples containing an account model and its corresponding balance, or a database error.
pub async fn get_accounts_with_balance(
    db: &DatabaseConnection,
    options: AccountsQueryOptions,
) -> Result<Vec<(accounts::Model, f32)>, DbErr> {
    let accounts = get_accounts(db, options).await?;
    force_raw_join(db, &accounts).await
}

/// Retrieves a single account along with its balance based on the provided query options.
///
/// # Arguments
///
/// * `db` - A reference to the database connection.
/// * `options` - An `AccountsQueryOptions` struct containing filter parameters.
///
/// # Returns
///
/// * `Result<Option<(accounts::Model, f32)>, DbErr>` - An optional tuple containing an account model and its corresponding balance, or a database error. Returns `None` if no account matches the filter.
pub async fn get_account_with_balance(
    db: &DatabaseConnection,
    options: AccountsQueryOptions,
) -> Result<Option<(accounts::Model, f32)>, DbErr> {
    let account = get_account(db, options).await?;

    if account.is_none() {
        return Ok(None);
    }

    let accounts_with_balance = force_raw_join(db, &vec![account.unwrap()]).await?;
    Ok(accounts_with_balance.first().cloned())
}

// This is a workaround to get the balance of an account.
// I could not figure out how to properly make joins in sea-orm.
// The documentation on it is not ideal at present.
// I'll come back to this later.
async fn force_raw_join(
    db: &DatabaseConnection,
    accounts: &Vec<accounts::Model>,
) -> Result<Vec<(accounts::Model, f32)>, DbErr> {
    let account_ids: Vec<String> = accounts
        .iter()
        .map(|account| account.id.to_string())
        .collect();
    let raw_sql = match db.get_database_backend() {
        DbBackend::Postgres => {
            let account_ids_str = account_ids.join("','");
            format!(
                "SELECT a.id as account_id, COALESCE(t.balance, 0.0) as balance
                 FROM accounts a
                 LEFT JOIN transactions t ON a.id = t.account_id AND t.sequence_number = a.max_sequence_number
                 WHERE a.id IN ('{}')",
                account_ids_str
            )
        }
        DbBackend::MySql | DbBackend::Sqlite => {
            let account_ids: Vec<String> = accounts
                .iter()
                .map(|account| format!("'{}'", account.id))
                .collect();

            let account_ids_str = account_ids.join(",");
            format!(
                "SELECT a.id as account_id, COALESCE(t.balance, 0.0) as balance
                 FROM accounts a
                 LEFT JOIN transactions t ON a.id = t.account_id AND t.sequence_number = a.max_sequence_number
                 WHERE a.id IN ({})",
                account_ids_str
            )
        }
    };

    let sql_result = db
        .query_all(Statement::from_string(db.get_database_backend(), raw_sql))
        .await?;

    let accounts_with_balance = sql_result
        .iter()
        .map(|row| {
            let account_id: Uuid = row.try_get("", "account_id")?;
            let balance: f32 = row.try_get("", "balance")?;
            Ok((account_id, balance))
        })
        .collect::<Result<Vec<(Uuid, f32)>, DbErr>>()?
        .into_iter()
        .map(|(account_id, balance)| {
            let account = accounts
                .iter()
                .find(|acc| acc.id == account_id)
                .unwrap()
                .clone();
            Ok((account, balance))
        })
        .collect::<Result<Vec<(accounts::Model, f32)>, DbErr>>()?;

    Ok(accounts_with_balance)
}
