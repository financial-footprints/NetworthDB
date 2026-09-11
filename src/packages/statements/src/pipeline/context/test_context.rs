use logger::{with_tee_capture, InstallOptions, Logger};

use super::{raise_if_cancelled, RunContext};

fn install_test_logger() {
    let _ = Logger::install(InstallOptions::new("test"));
}

#[test]
fn raise_if_cancelled_no_hook() {
    let ctx = RunContext::new();
    assert!(raise_if_cancelled(&ctx).is_ok());
}

#[test]
fn raise_if_cancelled_when_true() {
    let ctx = RunContext::with_cancel(Box::new(|| true));
    assert!(raise_if_cancelled(&ctx).is_err());
}

#[test]
fn raise_if_cancelled_when_false() {
    let ctx = RunContext::with_cancel(Box::new(|| false));
    assert!(raise_if_cancelled(&ctx).is_ok());
}

#[test]
fn trace_logs_when_enabled() {
    install_test_logger();
    let ctx = RunContext::with_trace();

    let (_, captured) = with_tee_capture(|| {
        ctx.trace_info("extract", "started", None);
        ctx.trace_warn("cleanup", "skipped month", None);
    })
    .expect("capture");

    let lines: Vec<&str> = captured.lines().collect();
    assert_eq!(lines.len(), 2);
    assert!(lines[0].contains("\"stage\":\"extract\""));
    assert!(lines[0].contains("\"msg\":\"started\""));
    assert!(lines[1].contains("\"level\":\"warn\""));
}

#[test]
fn trace_disabled_by_default() {
    install_test_logger();
    let ctx = RunContext::new();

    let (_, captured) = with_tee_capture(|| {
        ctx.trace_info("extract", "started", None);
    })
    .expect("capture");

    assert!(captured.is_empty());
}
