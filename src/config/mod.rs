mod types;

use std::env;

pub(crate) async fn get_config() -> types::Config {
    dotenvy::dotenv().ok();

    if let Ok(env_file_path) = env::var("ENV_FILE_PATH") {
        let reason = "Failed to load environment variables from specified path";
        dotenvy::from_path(&env_file_path).expect(&format!(
            "error.config.get_config.cannot_load_with_path: {}",
            reason
        ));
    }

    let file_path = env::var("FILE_PATH").expect("error.config.get_config.file_path_not_found");
    let file_secret = env::var("FILE_SECRET").unwrap_or_default();

    let database_url =
        env::var("DATABASE_URL").expect("error.config.get_config.database_url_not_found");

    return types::Config {
        db: get_database_connection(&database_url).await,
        file_path,
        file_secret,
    };
}

async fn get_database_connection(database_url: &str) -> sea_orm::DatabaseConnection {
    sea_orm::Database::connect(database_url)
        .await
        .expect("error.config.get_config.cannot_connect_to_database")
}
