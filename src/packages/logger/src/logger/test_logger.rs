use std::sync::Mutex;

use super::{
    current_ray_id, log, scope, with_tee_capture, InstallOptions, LogDestination, LogError,
    LogLevel, Logger,
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
fn with_tee_capture_collects_jsonl_lines() {
    let _guard = TEST_LOCK.lock().unwrap();
    let _logger = install_test_logger();

    let (_, captured) = with_tee_capture(|| {
        log(LogLevel::Info, "pipeline started", None, None).expect("log");
        log(LogLevel::Warn, "skipped month", None, None).expect("log");
    })
    .expect("capture");

    let lines: Vec<&str> = captured.lines().collect();
    assert_eq!(lines.len(), 2);
    assert!(lines[0].contains("\"msg\":\"pipeline started\""));
    assert!(lines[1].contains("\"level\":\"warn\""));
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
