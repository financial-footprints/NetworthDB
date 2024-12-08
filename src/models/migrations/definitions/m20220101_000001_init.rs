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
            DbBackend::Sqlite => Expr::cust("lower(hex(randomblob(16)))"),
            DbBackend::Postgres => Expr::cust("gen_random_uuid()"),
            DbBackend::MySql => Expr::cust("UUID()"),
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
                    .col(
                        timestamp(Accounts::UpdatedAt)
                            .default(Expr::current_timestamp())
                            .not_null(),
                    )
                    .col(string(Accounts::AccountNumber).not_null())
                    .col(
                        big_integer(Accounts::MaxSequenceNumber)
                            .default(0)
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(Accounts::Type)
                            .custom(AccountType::name())
                            .not_null(),
                    )
                    .to_owned(),
            )
            .await?;

        // Create trigger to update UpdatedAt timestamp
        match schema {
            DbBackend::Postgres => {
                manager
                    .get_connection()
                    .execute_unprepared(
                        r#"
                        CREATE OR REPLACE FUNCTION auto_change_updated_at()
                        RETURNS TRIGGER AS $$
                        BEGIN
                            NEW.updated_at = CURRENT_TIMESTAMP;
                            RETURN NEW;
                        END;
                        $$ language 'plpgsql';

                        CREATE TRIGGER accounts_auto_change_updated_at
                            BEFORE UPDATE ON accounts
                            FOR EACH ROW
                            EXECUTE FUNCTION auto_change_updated_at();
                        "#,
                    )
                    .await?;
            }
            DbBackend::MySql => {
                manager
                    .get_connection()
                    .execute_unprepared(
                        r#"
                        CREATE TRIGGER accounts_auto_change_updated_at
                            BEFORE UPDATE ON accounts
                            FOR EACH ROW
                            SET NEW.updated_at = CURRENT_TIMESTAMP;
                        "#,
                    )
                    .await?;
            }
            DbBackend::Sqlite => {
                manager
                    .get_connection()
                    .execute_unprepared(
                        r#"
                        CREATE TRIGGER accounts_auto_change_updated_at
                            AFTER UPDATE ON accounts
                            BEGIN
                                UPDATE accounts SET updated_at = CURRENT_TIMESTAMP
                                WHERE id = NEW.id;
                            END;
                        "#,
                    )
                    .await?;
            }
        }

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
                    .col(uuid(Transactions::AccountId).not_null())
                    .col(float(Transactions::Amount).not_null())
                    .col(float(Transactions::Balance).not_null())
                    .col(timestamp(Transactions::Date).not_null())
                    .col(string(Transactions::Description).not_null())
                    .col(string(Transactions::RefNo).not_null())
                    .col(big_integer(Transactions::SequenceNumber).not_null())
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_transaction_account")
                            .from(Transactions::Table, Transactions::AccountId)
                            .to(Accounts::Table, Accounts::Id)
                            .on_delete(ForeignKeyAction::Cascade)
                            .on_update(ForeignKeyAction::Cascade),
                    )
                    .index(
                        Index::create()
                            .name("uniq_accountid_sequencenumber")
                            .table(Transactions::Table)
                            .col(Transactions::AccountId)
                            .col(Transactions::SequenceNumber)
                            .unique(),
                    )
                    .to_owned(),
            )
            .await?;

        // Create trigger to update max_sequence_number
        match schema {
            DbBackend::Postgres => {
                manager
                    .get_connection()
                    .execute_unprepared(
                        r#"
                        CREATE OR REPLACE FUNCTION update_max_sequence_number()
                        RETURNS TRIGGER AS $$
                        BEGIN
                            UPDATE accounts
                            SET max_sequence_number = NEW.sequence_number
                            WHERE id = NEW.account_id
                            AND max_sequence_number < NEW.sequence_number;
                            RETURN NEW;
                        END;
                        $$ LANGUAGE 'plpgsql';

                        CREATE TRIGGER update_max_sequence_number_trigger
                            AFTER INSERT OR UPDATE ON transactions
                            FOR EACH ROW
                            EXECUTE FUNCTION update_max_sequence_number();

                        CREATE OR REPLACE FUNCTION update_max_sequence_number_on_delete()
                        RETURNS TRIGGER AS $$
                        BEGIN
                            UPDATE accounts
                            SET max_sequence_number = (
                                SELECT COALESCE(MAX(sequence_number), 0)
                                FROM transactions
                                WHERE account_id = OLD.account_id
                            )
                            WHERE id = OLD.account_id
                            AND OLD.sequence_number = accounts.max_sequence_number;
                            RETURN OLD;
                        END;
                        $$ LANGUAGE 'plpgsql';

                        CREATE TRIGGER update_max_sequence_number_on_delete_trigger
                            AFTER DELETE ON transactions
                            FOR EACH ROW
                            EXECUTE FUNCTION update_max_sequence_number_on_delete();
                        "#,
                    )
                    .await?;
            }
            DbBackend::MySql => {
                manager
                    .get_connection()
                    .execute_unprepared(
                        r#"
                        CREATE TRIGGER update_max_sequence_number
                            AFTER INSERT OR UPDATE ON transactions
                            FOR EACH ROW
                            BEGIN
                                UPDATE accounts
                                SET max_sequence_number = NEW.sequence_number
                                WHERE id = NEW.account_id
                                AND max_sequence_number < NEW.sequence_number;
                            END;

                        CREATE TRIGGER update_max_sequence_number_on_delete
                            AFTER DELETE ON transactions
                            FOR EACH ROW
                            BEGIN
                                UPDATE accounts
                                SET max_sequence_number = (
                                    SELECT COALESCE(MAX(sequence_number), 0)
                                    FROM transactions
                                    WHERE account_id = OLD.account_id
                                )
                                WHERE id = OLD.account_id
                                AND OLD.sequence_number = accounts.max_sequence_number;
                            END;
                        "#,
                    )
                    .await?;
            }
            DbBackend::Sqlite => {
                manager
                    .get_connection()
                    .execute_unprepared(
                        r#"
                        CREATE TRIGGER update_max_sequence_number
                            AFTER INSERT OR UPDATE ON transactions
                            BEGIN
                                UPDATE accounts
                                SET max_sequence_number = NEW.sequence_number
                                WHERE id = NEW.account_id
                                AND max_sequence_number < NEW.sequence_number;
                            END;

                        CREATE TRIGGER update_max_sequence_number_on_delete
                            AFTER DELETE ON transactions
                            BEGIN
                                UPDATE accounts
                                SET max_sequence_number = (
                                    SELECT COALESCE(MAX(sequence_number), 0)
                                    FROM transactions
                                    WHERE account_id = OLD.account_id
                                )
                                WHERE id = OLD.account_id
                                AND OLD.sequence_number = accounts.max_sequence_number;
                            END;
                        "#,
                    )
                    .await?;
            }
        }

        // Create index on date
        match schema {
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
                    .col(string(Imports::AccountNumber))
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
                    .col(uuid(StagedTransactions::ImportId).not_null())
                    .col(date_time(StagedTransactions::Date).not_null())
                    .col(float(StagedTransactions::Amount).not_null())
                    .col(float(StagedTransactions::Balance).not_null())
                    .col(string(StagedTransactions::RefNo).not_null())
                    .col(string(StagedTransactions::Description).not_null())
                    .col(big_integer(StagedTransactions::SequenceNumber).not_null())
                    .index(
                        Index::create()
                            .name("uniq_importid_sequencenumber")
                            .table(StagedTransactions::Table)
                            .col(StagedTransactions::ImportId)
                            .col(StagedTransactions::SequenceNumber)
                            .unique(),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_staged_staging")
                            .from(StagedTransactions::Table, StagedTransactions::ImportId)
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

        // Drop trigger
        match schema {
            DbBackend::Postgres => {
                manager
                    .get_connection()
                    .execute_unprepared(r#"DROP FUNCTION update_max_sequence_number();"#)
                    .await?;

                manager
                    .get_connection()
                    .execute_unprepared(r#"DROP FUNCTION auto_change_updated_at();"#)
                    .await?;
            }
            DbBackend::MySql => {}
            DbBackend::Sqlite => {}
        }

        Ok(())
    }
}

#[derive(DeriveIden)]
enum Accounts {
    Table,
    Id,
    AccountNumber,
    UpdatedAt,
    MaxSequenceNumber,
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
    #[sea_orm(string_value = "unknown")]
    Unknown,
}

#[derive(DeriveIden)]
enum Transactions {
    Table,
    Id,
    AccountId,
    SequenceNumber,
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
    ImportId,
    SequenceNumber,
    Date,
    Description,
    RefNo,
    Amount,
    Balance,
}
