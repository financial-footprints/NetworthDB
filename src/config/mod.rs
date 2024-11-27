mod types;

use crate::config::types::Config;
use std::env;

use lazy_static::lazy_static;

lazy_static! {
    pub(crate) static ref CONFIG: Config = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap()
        .block_on(get_config());
}

async fn get_config() -> Config {
    dotenvy::dotenv().ok();

    if let Ok(env_file_path) = env::var("ENV_FILE_PATH") {
        dotenvy::from_path(&env_file_path)
            .ok()
            .expect("error.config.get_config.cannot_load_env_file");
    }

    let file_path = env::var("FILE_PATH").expect("error.config.get_config.file_path_not_found");
    let file_secret = env::var("FILE_SECRET").unwrap_or_default();

    let database_url =
        env::var("DATABASE_URL").expect("error.config.get_config.database_url_not_found");
    let db = get_database_connection(&database_url).await;

    return Config {
        db,
        file_path,
        file_secret,
    };
}

async fn get_database_connection(database_url: &str) -> sea_orm::DatabaseConnection {
    sea_orm::Database::connect(database_url)
        .await
        .expect("error.config.get_config.cannot_connect_to_database")
}
