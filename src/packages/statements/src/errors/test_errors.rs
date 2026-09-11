use super::{JobCancelledError, StageError};

#[test]
fn stage_error_display() {
    let err = StageError::new("FY folder not found");
    assert!(err.to_string().contains("FY folder not found"));
}

#[test]
fn job_cancelled_display() {
    let err = JobCancelledError;
    assert_eq!(err.to_string(), "cancelled by user");
}
