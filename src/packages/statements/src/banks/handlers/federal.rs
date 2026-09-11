use chrono::NaiveDate;

use super::base::{BankHandler, CreditCardHandler};
use super::mixins::top_range_statement_period;
use crate::banks::helpers::{
    edge_summary_closing, edge_summary_opening, first_not_none, inject_edge_summary_labels,
    label_next_line_amount, label_range_end, label_range_period, label_single_date_end,
    summary_table_row, top_range_end,
};

pub struct FederalDefaultHandler;

impl BankHandler for FederalDefaultHandler {
    fn mail_subjects(&self) -> Vec<String> {
        vec!["Federal Bank Credit Card Statement".to_string()]
    }

    fn get_statement_date(&self, text: &str) -> Option<NaiveDate> {
        super::mixins::top_range_statement_date(text, " - ", 2000)
    }

    fn get_statement_period(&self, text: &str) -> (Option<NaiveDate>, Option<NaiveDate>) {
        top_range_statement_period(text, " - ", 2000)
    }

    fn get_opening_balance(&self, text: &str) -> Option<String> {
        edge_summary_opening(text)
    }

    fn get_closing_balance(&self, text: &str) -> Option<String> {
        edge_summary_closing(text)
    }
}

pub struct FederalSignetHandler;

impl BankHandler for FederalSignetHandler {
    fn mail_subjects(&self) -> Vec<String> {
        vec!["Credit Card Statement".to_string()]
    }

    fn trim_end(&self) -> Vec<&'static str> {
        vec!["GSTN of Federal Bank"]
    }

    fn drop_sections(&self) -> Vec<&'static str> {
        vec![
            "The following illustration will indicate",
            "Organic Credit Cards",
            "Transaction dispute needs to be reported",
        ]
    }

    fn get_statement_date(&self, text: &str) -> Option<NaiveDate> {
        first_not_none([
            label_single_date_end(text, "Statement Date"),
            label_range_end(text, "Statement Period", " to "),
            top_range_end(text, " - ", 2000),
        ])
    }

    fn get_statement_period(&self, text: &str) -> (Option<NaiveDate>, Option<NaiveDate>) {
        let (start, end) = label_range_period(text, "Statement Period", " to ");
        if start.is_some() && end.is_some() {
            return (start, end);
        }
        CreditCardHandler::default_statement_period(text, self.get_statement_date(text))
    }

    fn get_opening_balance(&self, text: &str) -> Option<String> {
        summary_table_row(text, "Payment Due Date", 1, "opening")
    }

    fn get_closing_balance(&self, text: &str) -> Option<String> {
        first_not_none([
            label_next_line_amount(text, "Total Amount Due (in Rs.)"),
            summary_table_row(text, "Payment Due Date", 1, "closing"),
        ])
    }
}

pub struct FederalEdgeHandler;

impl BankHandler for FederalEdgeHandler {
    fn mail_subjects(&self) -> Vec<String> {
        vec!["Edge Federal Bank Credit Card Statement".to_string()]
    }

    fn trim_end(&self) -> Vec<&'static str> {
        vec!["End of Transactions"]
    }

    fn drop_sections(&self) -> Vec<&'static str> {
        vec!["IMPORTANT INFORMATION", "Issued by"]
    }

    fn clean_text(&self, raw: &str) -> String {
        let cleaned = FederalDefaultHandler.clean_text(raw);
        inject_edge_summary_labels(&cleaned)
    }

    fn get_statement_date(&self, text: &str) -> Option<NaiveDate> {
        FederalDefaultHandler.get_statement_date(text)
    }

    fn get_statement_period(&self, text: &str) -> (Option<NaiveDate>, Option<NaiveDate>) {
        FederalDefaultHandler.get_statement_period(text)
    }

    fn get_opening_balance(&self, text: &str) -> Option<String> {
        FederalDefaultHandler.get_opening_balance(text)
    }

    fn get_closing_balance(&self, text: &str) -> Option<String> {
        FederalDefaultHandler.get_closing_balance(text)
    }
}
