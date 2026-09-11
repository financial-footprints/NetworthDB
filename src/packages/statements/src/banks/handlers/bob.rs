use chrono::NaiveDate;

use super::base::BankHandler;
use super::mixins::{bob_statement_date, bob_statement_period};
use crate::banks::helpers::{first_not_none, summary_table_column, summary_table_row};

pub struct BobDefaultHandler;

impl BankHandler for BobDefaultHandler {
    fn mail_subjects(&self) -> Vec<String> {
        vec![
            "E-statement for your BOB".to_string(),
            "E-statement for your BOBCARD".to_string(),
            "Duplicate Statement from BOB Card".to_string(),
        ]
    }

    fn trim_end(&self) -> Vec<&'static str> {
        vec!["Reward Summary at Card Level", "Page 1 of"]
    }

    fn get_statement_date(&self, text: &str) -> Option<NaiveDate> {
        bob_statement_date(text)
    }

    fn get_statement_period(&self, text: &str) -> (Option<NaiveDate>, Option<NaiveDate>) {
        bob_statement_period(text)
    }

    fn get_opening_balance(&self, text: &str) -> Option<String> {
        first_not_none([
            summary_table_column(text, "Account Summary", "Opening Balance", 2000),
            summary_table_column(
                text,
                "This Month's Statement At A Glance",
                "Opening Balance",
                2000,
            ),
            summary_table_row(text, "GST No:", 2, "opening"),
            summary_table_row(text, "GST No:", 1, "opening"),
        ])
    }

    fn get_closing_balance(&self, text: &str) -> Option<String> {
        first_not_none([
            summary_table_column(text, "Account Summary", "Closing Balance", 2000),
            summary_table_column(
                text,
                "This Month's Statement At A Glance",
                "Closing Balance",
                2000,
            ),
            summary_table_row(text, "GST No:", 2, "closing"),
            summary_table_row(text, "GST No:", 1, "closing"),
        ])
    }
}

pub struct BobEasyHandler;

impl BankHandler for BobEasyHandler {
    fn mail_subjects(&self) -> Vec<String> {
        vec![
            "E-statement for your BOB EASY credit card ending in".to_string(),
            "E-statement for your BOBCARD EASY credit card ending in".to_string(),
            "E-statement for your BOBCARD RUPAY EASY credit card ending".to_string(),
            "Duplicate Statement from BOB Card".to_string(),
        ]
    }

    fn trim_end(&self) -> Vec<&'static str> {
        BobDefaultHandler.trim_end()
    }

    fn drop_sections(&self) -> Vec<&'static str> {
        vec![
            "Please register your Mobile No. & E-Mail ID",
            "Please register your Mobile No. and Email ID",
            "Please register your Mobile Number & Email ID",
            "Loan Summary",
            "GO DIGITAL to SELF-SERVICE",
            "YOUR CONVENIENCE IS OUR PRIORITY",
            "Did You Know",
            "SCHEDULE OF CHARGES",
            "IMPORTANT",
            "CIBIL Information",
            "Billing Dispute Resolution",
            "For T&C & details on Fee/charges",
            "Important Security Update for Your BOBCARD",
            "via the BOBCARD mobile app or portal",
            "Clickheretoknowmore",
        ]
    }

    fn get_statement_date(&self, text: &str) -> Option<NaiveDate> {
        BobDefaultHandler.get_statement_date(text)
    }

    fn get_statement_period(&self, text: &str) -> (Option<NaiveDate>, Option<NaiveDate>) {
        BobDefaultHandler.get_statement_period(text)
    }

    fn get_opening_balance(&self, text: &str) -> Option<String> {
        BobDefaultHandler.get_opening_balance(text)
    }

    fn get_closing_balance(&self, text: &str) -> Option<String> {
        BobDefaultHandler.get_closing_balance(text)
    }
}
