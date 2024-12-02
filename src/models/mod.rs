//! This module will give you all the seaORM entities to
//! interact the SQL tables

use networth_db_migrations::{MigrationTrait, MigratorTrait};
pub mod custom_entity;
pub mod entity;
pub mod writers;

/// Returns a vector of all database migrations defined in the NetworthDB's migration
///
/// This function provides access to the migrations defined in the migration crate's
/// Migrator implementation. These migrations handle database schema changes and
/// are executed in order based on their timestamps.
///
/// # Returns
///
/// * `Vec<Box<dyn MigrationTrait>>` - A vector of boxed migrations that implement
///   the MigrationTrait
pub fn migrations() -> Vec<Box<dyn MigrationTrait>> {
    networth_db_migrations::Migrator::migrations()
}
