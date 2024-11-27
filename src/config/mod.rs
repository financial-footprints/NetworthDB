mod types;

use crate::config::types::Config;
use std::env;

use lazy_static::lazy_static;

lazy_static! {
    pub(crate) static ref CONFIG: Config = read_env_file();
}

fn read_env_file() -> Config {
    dotenv::dotenv().ok();

    if let Ok(env_file_path) = env::var("ENV_FILE_PATH") {
        dotenv::from_path(&env_file_path)
            .ok()
            .expect("error.main.get_files.cannot_load_env_file");
    }

    let file_path = env::var("FILE_PATH").expect("error.main.get_files.file_path_not_found");
    let file_secret = env::var("FILE_SECRET").unwrap_or_default();

    return Config {
        file_path,
        file_secret,
    };
}
