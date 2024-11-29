#[cfg(test)]
mod tests;

use sea_orm::{
    prelude::DateTimeUtc,
    sqlx::types::chrono::{DateTime, Utc},
};

pub fn get_current_datetime() -> DateTimeUtc {
    Utc::now()
}

pub fn date_str_to_datetime(date: &str) -> DateTimeUtc {
    return match DateTime::parse_from_str(
        &format!("{} 00:00:00 +0000", date.trim()),
        "%d/%m/%Y %H:%M:%S %z",
    ) {
        Ok(dt) => dt.with_timezone(&Utc),
        Err(e) => {
            tracing::error!(
                "error.utils.datetime.date_str_to_datetime: {} - {}",
                date,
                e
            );
            panic!("error.utils.datetime.date_str_to_datetime");
        }
    };
}
