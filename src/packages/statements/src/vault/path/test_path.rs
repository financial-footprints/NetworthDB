use super::{account_metadata_relative, statement_relative_path, transactions_csv_name};

const ACCOUNT_ID: &str = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

#[test]
fn monthly_pdf_path() {
    let relative = statement_relative_path("credit_card", ACCOUNT_ID, "2024-01", "pdf");
    assert_eq!(
        relative,
        format!("FY23-2024/credit_card/{}/2024-01.pdf", ACCOUNT_ID)
    );
}

#[test]
fn monthly_csv_path() {
    let relative = statement_relative_path("credit_card", ACCOUNT_ID, "2024-04", "csv");
    assert_eq!(
        relative,
        format!("FY24-2025/credit_card/{}/2024-04.csv", ACCOUNT_ID)
    );
}

#[test]
fn annual_pdf_path() {
    let relative = statement_relative_path("credit_card", ACCOUNT_ID, "FY24-2025", "pdf");
    assert_eq!(
        relative,
        format!("FY24-2025/credit_card/{}/2025.pdf", ACCOUNT_ID)
    );
}

#[test]
fn metadata_path() {
    assert_eq!(
        account_metadata_relative("credit_card", ACCOUNT_ID),
        format!("credit_card/{}/metadata.json", ACCOUNT_ID)
    );
}

#[test]
fn transactions_csv_name_format() {
    assert_eq!(transactions_csv_name("2024-01"), "transactions-2024-01.csv");
}
