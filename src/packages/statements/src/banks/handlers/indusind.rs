use chrono::NaiveDate;

use super::base::BankHandler;
use super::mixins::context_range_statement_period;
use crate::banks::helpers::{
    date_after_label, first_not_none, label_next_line_amount, total_outstanding_section_amount,
};

pub struct IndusindDefaultHandler;

impl BankHandler for IndusindDefaultHandler {
    fn mail_subjects(&self) -> Vec<String> {
        vec!["IndusInd Bank Credit Card".to_string()]
    }

    fn trim_end(&self) -> Vec<&'static str> {
        vec!["Rewards Opening Balance", "Rewards OpeningBalance"]
    }

    fn drop_sections(&self) -> Vec<&'static str> {
        vec![
            "IMPORTANT MESSAGES:",
            "IMPORTANTMESSAGES:",
            "PROMOTIONAL MESSAGES:",
            "PROMOTIONALMESSAGES:",
            "MARKETING MESSAGE",
            "MARKETINGMESSAGE",
            "NOTE: *Total of points redeemed",
            "With IndusAlerts",
            "Secure your IndusInd Bank Credit Card on-the-go",
            "HOW TO MAKE PAYMENTS",
            "FEES & CHARGES",
            "CREDIT AND CASH WITHDRAWAL LIMITS",
            "Pleasedrawyourcheque",
            "Closest IndusInd Bank ATM Drop Box",
            "Manage your Card with instant Card blocking",
        ]
    }

    fn get_statement_date(&self, text: &str) -> Option<NaiveDate> {
        let end = super::mixins::context_range_statement_date(text, "Statement Period", " To ");
        end.or_else(|| date_after_label(text, "Statement Date"))
    }

    fn get_statement_period(&self, text: &str) -> (Option<NaiveDate>, Option<NaiveDate>) {
        context_range_statement_period(text, "Statement Period", " To ")
    }

    fn get_opening_balance(&self, text: &str) -> Option<String> {
        label_next_line_amount(text, "Previous Balance")
    }

    fn get_closing_balance(&self, text: &str) -> Option<String> {
        first_not_none([
            total_outstanding_section_amount(text),
            label_next_line_amount(text, "Total Amount Due"),
        ])
    }
}

pub struct IndusindAuraedgeHandler;
pub struct IndusindAmexEpayHandler;

impl BankHandler for IndusindAuraedgeHandler {
    fn mail_subjects(&self) -> Vec<String> {
        IndusindDefaultHandler.mail_subjects()
    }
    fn trim_end(&self) -> Vec<&'static str> {
        IndusindDefaultHandler.trim_end()
    }
    fn drop_sections(&self) -> Vec<&'static str> {
        IndusindDefaultHandler.drop_sections()
    }
    fn get_statement_date(&self, text: &str) -> Option<NaiveDate> {
        IndusindDefaultHandler.get_statement_date(text)
    }
    fn get_statement_period(&self, text: &str) -> (Option<NaiveDate>, Option<NaiveDate>) {
        IndusindDefaultHandler.get_statement_period(text)
    }
    fn get_opening_balance(&self, text: &str) -> Option<String> {
        IndusindDefaultHandler.get_opening_balance(text)
    }
    fn get_closing_balance(&self, text: &str) -> Option<String> {
        IndusindDefaultHandler.get_closing_balance(text)
    }
}

impl BankHandler for IndusindAmexEpayHandler {
    fn mail_subjects(&self) -> Vec<String> {
        IndusindDefaultHandler.mail_subjects()
    }
    fn trim_end(&self) -> Vec<&'static str> {
        IndusindDefaultHandler.trim_end()
    }
    fn drop_sections(&self) -> Vec<&'static str> {
        IndusindDefaultHandler.drop_sections()
    }
    fn get_statement_date(&self, text: &str) -> Option<NaiveDate> {
        IndusindDefaultHandler.get_statement_date(text)
    }
    fn get_statement_period(&self, text: &str) -> (Option<NaiveDate>, Option<NaiveDate>) {
        IndusindDefaultHandler.get_statement_period(text)
    }
    fn get_opening_balance(&self, text: &str) -> Option<String> {
        IndusindDefaultHandler.get_opening_balance(text)
    }
    fn get_closing_balance(&self, text: &str) -> Option<String> {
        IndusindDefaultHandler.get_closing_balance(text)
    }
}
