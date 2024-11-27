pub struct Config {
    pub db: sea_orm::DatabaseConnection,
    pub file_path: String,
    pub file_secret: String,
}
