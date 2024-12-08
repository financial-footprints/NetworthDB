pub mod accounts;
pub mod imports;
pub mod staged_transactions;
pub mod transactions;
use sea_orm::{entity::*, query::*};
use sea_orm::{prelude::DateTime, Select};
use serde::Deserialize;

#[derive(Debug, Deserialize)]

pub enum NumberFilterType {
    GreaterThan,
    EqualOrGreaterThan,
    EqualOrLessThan,
    LessThan,
    Equal,
}

#[derive(Debug, Deserialize)]
pub enum DateFilterType {
    GreaterThan,
    LessThan,
    Equal,
}

#[derive(Debug, Deserialize)]
pub enum StringFilterType {
    Contains,
    NotContains,
    Equal,
    StartsWith,
    EndsWith,
}

pub(crate) fn apply_number_filter<E, C, T>(
    mut query: Select<E>,
    filter: Option<(NumberFilterType, T)>,
    column: C,
) -> Select<E>
where
    E: EntityTrait,
    C: ColumnTrait,
    T: Into<sea_orm::Value> + Copy,
{
    if let Some((filter_type, value)) = filter {
        query = match filter_type {
            NumberFilterType::GreaterThan => query.filter(column.gt(value.into())),
            NumberFilterType::LessThan => query.filter(column.lt(value.into())),
            NumberFilterType::Equal => query.filter(column.eq(value.into())),
            NumberFilterType::EqualOrGreaterThan => query.filter(column.gte(value.into())),
            NumberFilterType::EqualOrLessThan => query.filter(column.lte(value.into())),
        };
    }
    query
}

pub(crate) fn apply_date_filter<E, C>(
    mut query: Select<E>,
    filter: Option<(DateFilterType, DateTime)>,
    column: C,
) -> Select<E>
where
    E: EntityTrait,
    C: ColumnTrait,
{
    if let Some((filter_type, value)) = filter {
        query = match filter_type {
            DateFilterType::GreaterThan => query.filter(column.gt(value)),
            DateFilterType::LessThan => query.filter(column.lt(value)),
            DateFilterType::Equal => query.filter(column.eq(value)),
        };
    }
    query
}

pub(crate) fn apply_string_filter<E, C>(
    mut query: Select<E>,
    filter: Option<(StringFilterType, String)>,
    column: C,
) -> Select<E>
where
    E: EntityTrait,
    C: ColumnTrait,
{
    if let Some((filter_type, value)) = filter {
        query = match filter_type {
            StringFilterType::Contains => query.filter(column.contains(&value)),
            StringFilterType::NotContains => query.filter(column.not_like(&format!("%{}%", value))),
            StringFilterType::Equal => query.filter(column.eq(value)),
            StringFilterType::StartsWith => query.filter(column.starts_with(&value)),
            StringFilterType::EndsWith => query.filter(column.ends_with(&value)),
        };
    }
    query
}
