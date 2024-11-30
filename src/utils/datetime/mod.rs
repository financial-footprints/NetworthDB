#[cfg(test)]
mod tests;

use sea_orm::{
    prelude::DateTimeUtc,
    sqlx::types::chrono::{DateTime, Utc},
};

/// Returns the current UTC datetime
pub fn get_current_datetime() -> DateTimeUtc {
    Utc::now()
}

/// Converts a date string in format "DD/MM/YYYY" to a UTC datetime
///
/// # Arguments
/// * `date` - Date string in format "DD/MM/YYYY"
///
/// # Returns
/// * `DateTimeUtc` - UTC datetime with time set to midnight
///
/// # Panics
/// * If the date string cannot be parsed
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
