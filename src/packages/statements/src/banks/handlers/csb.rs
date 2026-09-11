use chrono::NaiveDate;

use super::base::BankHandler;
use super::mixins::top_range_statement_period;
use crate::banks::helpers::{
    edge_summary_closing, edge_summary_opening, inject_edge_summary_labels,
};

pub struct CsbDefaultHandler;

impl BankHandler for CsbDefaultHandler {
    fn mail_subjects(&self) -> Vec<String> {
        vec!["Credit Card Statement".to_string()]
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

pub struct CsbEdgeHandler;

impl BankHandler for CsbEdgeHandler {
    fn mail_subjects(&self) -> Vec<String> {
        vec!["Edge CSB Bank RuPay Credit Card Statement".to_string()]
    }

    fn trim_end(&self) -> Vec<&'static str> {
        vec!["End of Transactions"]
    }

    fn clean_text(&self, raw: &str) -> String {
        let cleaned = CsbDefaultHandler.clean_text(raw);
        inject_edge_summary_labels(&cleaned)
    }

    fn get_statement_date(&self, text: &str) -> Option<NaiveDate> {
        CsbDefaultHandler.get_statement_date(text)
    }

    fn get_statement_period(&self, text: &str) -> (Option<NaiveDate>, Option<NaiveDate>) {
        CsbDefaultHandler.get_statement_period(text)
    }

    fn get_opening_balance(&self, text: &str) -> Option<String> {
        CsbDefaultHandler.get_opening_balance(text)
    }

    fn get_closing_balance(&self, text: &str) -> Option<String> {
        CsbDefaultHandler.get_closing_balance(text)
    }
}
