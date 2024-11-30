//! Manipulate Statement Object

use crate::{
    models::entity::{imports, staged_transactions},
    readers::parsers::types::Statement,
};
use sea_orm::{
    prelude::Decimal, sqlx::types::chrono::Utc, ActiveValue::Set, DatabaseConnection, EntityTrait,
};
use uuid::Uuid;
/// Put statement object in database
///
/// # Arguments
/// * `db` - Database connection handle
/// * `statement` - Statement object containing account and transaction data
///
/// # Returns
/// * `Uuid` - ID of the created import staging record
pub async fn set_stage_statement(db: &DatabaseConnection, statement: &Statement) -> Uuid {
    // Create transaction staging record
    let staging = imports::ActiveModel {
        id: Set(Uuid::new_v4()),
        account_number: Set(statement.account_number.clone()),
        import_date: Set(Utc::now()),
        source_file_date: Set(statement.date),
        ..Default::default()
    };

    let staging_id = imports::Entity::insert(staging)
        .exec(db)
        .await
        .map_err(|err| {
            tracing::error!("error.writers.statement.stage_statement.imports: {}", err);
            err
        })
        .expect("error.writers.statement.stage_statement.imports")
        .last_insert_id;

    // Create transaction staged records
    let staged_transactions: Vec<staged_transactions::ActiveModel> = statement
        .transactions
        .iter()
        .map(|transaction| staged_transactions::ActiveModel {
            id: Set(Uuid::new_v4()),
            amount: Set(if transaction.deposit > Decimal::ZERO {
                transaction.deposit
            } else {
                -transaction.withdrawal
            }),
            staging_id: Set(staging_id),
            date: Set(transaction.date.naive_utc()),
            balance: Set(transaction.balance),
            ref_no: Set(transaction.ref_no.clone()),
            description: Set(transaction.description.clone()),
            ..Default::default()
        })
        .collect();

    staged_transactions::Entity::insert_many(staged_transactions)
        .exec(db)
        .await
        .map_err(|err| {
            tracing::error!(
                "error.writers.statement.stage_statement.staged_transactions: {}",
                err
            );
            err
        })
        .expect("error.writers.statement.stage_statement.staged_transactions");

    return staging_id;
}
