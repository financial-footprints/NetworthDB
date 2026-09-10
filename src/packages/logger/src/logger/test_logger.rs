use std::sync::Mutex;

use super::{
    current_ray_id, log, scope, InstallOptions, LogDestination, LogError, LogLevel, Logger,
};

static TEST_LOCK: Mutex<()> = Mutex::new(());

fn install_test_logger() -> Logger {
    Logger::install(InstallOptions {
        app: "test".to_string(),
        level: LogLevel::Info,
        destination: LogDestination::Console,
        process_ray_id: None,
    })
    .expect("logger")
}

#[test]
fn accepts_non_empty_messages() {
    let _guard = TEST_LOCK.lock().unwrap();
    let _logger = install_test_logger();

    assert!(log(LogLevel::Info, "middleware.http.ok", None, None).is_ok());
    assert!(log(LogLevel::Info, "request body too large", None, None).is_ok());
    assert!(log(LogLevel::Info, "listening", None, None).is_ok());
}

#[test]
fn rejects_empty_messages() {
    let _guard = TEST_LOCK.lock().unwrap();
    let _logger = install_test_logger();

    assert!(matches!(
        log(LogLevel::Info, "", None, None),
        Err(LogError::EmptyMessage)
    ));
    assert!(matches!(
        log(LogLevel::Info, "   ", None, None),
        Err(LogError::EmptyMessage)
    ));
}

#[tokio::test]
async fn scope_sets_ray_id() {
    {
        let _guard = TEST_LOCK.lock().unwrap();
        let _logger = install_test_logger();
    }

    scope("ray-scope", async {
        assert_eq!(current_ray_id(), Some("ray-scope".to_string()));
    })
    .await;
}

#[test]
fn parses_log_destination() {
    assert!(LogDestination::parse("console").is_ok());
    assert!(LogDestination::parse("stdout").is_ok());
    assert!(LogDestination::parse("stderr").is_ok());
    assert!(matches!(
        LogDestination::parse("cloudwatch"),
        Err(LogError::InvalidDestination(_))
    ));
}
