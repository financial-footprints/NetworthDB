//! `SeaORM` Entity, @generated by sea-orm-codegen 1.1.1

use sea_orm::entity::prelude::*;
use std::convert::TryInto;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Eq)]
#[sea_orm(table_name = "imports")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub account_number: String,
    pub import_date: DateTime,
    pub source_file_date: DateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::staged_transactions::Entity")]
    StagedTransactions,
}

impl Related<super::staged_transactions::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::StagedTransactions.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
