use sea_orm::DeriveIden;
use sea_orm_migration::{
    prelude::extension::postgres::Type,
    prelude::*,
    schema::*,
    sea_orm::{ActiveEnum, ConnectionTrait, DbBackend, DeriveActiveEnum, EnumIter, Schema},
};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Create account_type enum for Postgres
        let db = manager.get_connection();
        let schema = db.get_database_backend();
        let uuid_generator = match schema {
            DbBackend::Sqlite => Expr::cust("(lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))))"),
            DbBackend::Postgres => Expr::cust("gen_random_uuid()"),
            DbBackend::MySql => Expr::cust("UUID()")
        };

        match schema {
            DbBackend::Postgres => {
                manager
                    .create_type(
                        Schema::new(DbBackend::Postgres)
                            .create_enum_from_active_enum::<AccountType>(),
                    )
                    .await?;
            }
            DbBackend::MySql | DbBackend::Sqlite => {}
        }

        // Create Accounts table
        manager
            .create_table(
                Table::create()
                    .table(Accounts::Table)
                    .if_not_exists()
                    .col(
                        uuid(Accounts::Id)
                            .default(uuid_generator.clone())
                            .primary_key(),
                    )
                    .col(timestamp(Accounts::LastUpdated).not_null())
                    .col(string(Accounts::AccountNumber).not_null())
                    .col(
                        ColumnDef::new(Accounts::Type)
                            .custom(AccountType::name())
                            .not_null(),
                    )
                    .to_owned(),
            )
            .await?;

        // Create Transactions table
        manager
            .create_table(
                Table::create()
                    .table(Transactions::Table)
                    .if_not_exists()
                    .col(
                        uuid(Transactions::Id)
                            .default(uuid_generator.clone())
                            .primary_key(),
                    )
                    .col(timestamp(Transactions::Date).not_null())
                    .col(decimal(Transactions::Amount).not_null())
                    .col(decimal(Transactions::Balance).not_null())
                    .col(uuid(Transactions::AccountId).not_null())
                    .col(string(Transactions::RefNo).not_null())
                    .col(string(Transactions::Description).not_null())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_transaction_account")
                            .from(Transactions::Table, Transactions::AccountId)
                            .to(Accounts::Table, Accounts::Id)
                            .on_delete(ForeignKeyAction::Cascade)
                            .on_update(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        match db.get_database_backend() {
            DbBackend::Sqlite => {}
            DbBackend::MySql | DbBackend::Postgres => {
                manager
                    .create_index(
                        Index::create()
                            .name("idx_transaction_date")
                            .table(Transactions::Table)
                            .col(Transactions::Date)
                            .to_owned(),
                    )
                    .await?
            }
        }

        // Create Imports table
        manager
            .create_table(
                Table::create()
                    .table(Imports::Table)
                    .if_not_exists()
                    .col(
                        uuid(Imports::Id)
                            .default(uuid_generator.clone())
                            .primary_key(),
                    )
                    .col(string(Imports::AccountNumber).not_null())
                    .col(timestamp(Imports::ImportDate).not_null())
                    .col(timestamp(Imports::SourceFileDate).not_null())
                    .to_owned(),
            )
            .await?;

        // Create StagedTransactions table
        manager
            .create_table(
                Table::create()
                    .table(StagedTransactions::Table)
                    .if_not_exists()
                    .col(
                        uuid(StagedTransactions::Id)
                            .default(uuid_generator.clone())
                            .primary_key(),
                    )
                    .col(uuid(StagedTransactions::StagingId).not_null())
                    .col(date_time(StagedTransactions::Date).not_null())
                    .col(decimal(StagedTransactions::Amount).not_null())
                    .col(decimal(StagedTransactions::Balance).not_null())
                    .col(string(StagedTransactions::RefNo).not_null())
                    .col(string(StagedTransactions::Description).not_null())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_staged_staging")
                            .from(StagedTransactions::Table, StagedTransactions::StagingId)
                            .to(Imports::Table, Imports::Id)
                            .on_delete(ForeignKeyAction::Cascade)
                            .on_update(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(StagedTransactions::Table).to_owned())
            .await?;

        manager
            .drop_table(Table::drop().table(Imports::Table).to_owned())
            .await?;

        manager
            .drop_table(Table::drop().table(Transactions::Table).to_owned())
            .await?;

        manager
            .drop_table(Table::drop().table(Accounts::Table).to_owned())
            .await?;

        // Drop account_type enum for Postgres
        let db = manager.get_connection();
        let schema = db.get_database_backend();
        match schema {
            DbBackend::Postgres => {
                manager
                    .drop_type(Type::drop().name(AccountType::name()).to_owned())
                    .await?;
            }
            DbBackend::MySql | DbBackend::Sqlite => {}
        }

        Ok(())
    }
}

#[derive(DeriveIden)]
enum Accounts {
    Table,
    Id,
    AccountNumber,
    LastUpdated,
    Type,
}

#[derive(Debug, PartialEq, Eq, EnumIter, DeriveActiveEnum, DeriveIden)]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "account_type")]
pub enum AccountType {
    #[sea_orm(string_value = "checking_account")]
    CheckingAccount,
    #[sea_orm(string_value = "savings_account")]
    SavingsAccount,
    #[sea_orm(string_value = "credit_card")]
    CreditCard,
    #[sea_orm(string_value = "fixed_deposit")]
    FixedDeposit,
}

#[derive(DeriveIden)]
enum Transactions {
    Table,
    Id,
    AccountId,
    Date,
    Description,
    RefNo,
    Amount,
    Balance,
}

#[derive(DeriveIden)]
enum Imports {
    Table,
    Id,
    ImportDate,
    SourceFileDate,
    AccountNumber,
}

#[derive(DeriveIden)]
enum StagedTransactions {
    Table,
    Id,
    StagingId,
    Date,
    Description,
    RefNo,
    Amount,
    Balance,
}
