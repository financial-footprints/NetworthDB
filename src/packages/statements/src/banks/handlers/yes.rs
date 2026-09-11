use chrono::NaiveDate;

use super::base::BankHandler;
use super::mixins::context_range_statement_period;
use crate::banks::helpers::{first_not_none, label_next_line_amount, label_single_date_end};

pub struct YesDefaultHandler;

impl BankHandler for YesDefaultHandler {
    fn mail_subjects(&self) -> Vec<String> {
        vec!["Your YES_BANK".to_string()]
    }

    fn trim_end(&self) -> Vec<&'static str> {
        vec!["------------------End of the Statement------------------"]
    }

    fn drop_sections(&self) -> Vec<&'static str> {
        vec![
            "Your Reward Points Summary",
            "To redeem your Reward Points",
            "Important information :",
            "Important Information:",
            "Presenting EMI facility through e-Statements",
            "SMS  Help  space",
            "Important Safety Instructions",
            "Dear Cardmember,",
            "Making only the minimum payment every month",
            "from a wide range of options, please visit",
            "Simply click on the highlighted transactions",
            "YES TOUCH PhoneBanking Number",
            "At YES BANK, maintaining confidentiality",
            "Please click here for the Most Important Terms and Conditions",
            "YES BANK Credit Cards GSTIN",
            "Basis RBI circular on",
        ]
    }

    fn get_statement_date(&self, text: &str) -> Option<NaiveDate> {
        first_not_none([
            label_single_date_end(text, "Statement Date :"),
            super::mixins::context_range_statement_date(text, "Statement Period", " To "),
        ])
    }

    fn get_statement_period(&self, text: &str) -> (Option<NaiveDate>, Option<NaiveDate>) {
        context_range_statement_period(text, "Statement Period", " To ")
    }

    fn get_opening_balance(&self, text: &str) -> Option<String> {
        label_next_line_amount(text, "Previous Balance :")
    }

    fn get_closing_balance(&self, text: &str) -> Option<String> {
        label_next_line_amount(text, "Total Amount Due:")
    }
}

pub struct YesAceHandler;

impl BankHandler for YesAceHandler {
    fn mail_subjects(&self) -> Vec<String> {
        vec!["Your YES_BANK_ACE Rupay Credit Card E-Statement".to_string()]
    }

    fn trim_end(&self) -> Vec<&'static str> {
        YesDefaultHandler.trim_end()
    }

    fn drop_sections(&self) -> Vec<&'static str> {
        YesDefaultHandler.drop_sections()
    }

    fn get_statement_date(&self, text: &str) -> Option<NaiveDate> {
        YesDefaultHandler.get_statement_date(text)
    }

    fn get_statement_period(&self, text: &str) -> (Option<NaiveDate>, Option<NaiveDate>) {
        YesDefaultHandler.get_statement_period(text)
    }

    fn get_opening_balance(&self, text: &str) -> Option<String> {
        YesDefaultHandler.get_opening_balance(text)
    }

    fn get_closing_balance(&self, text: &str) -> Option<String> {
        YesDefaultHandler.get_closing_balance(text)
    }
}
