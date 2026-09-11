use chrono::NaiveDate;

use super::base::{BankHandler, CreditCardHandler};
use super::idfc_summary::{normalize_cr_dr_layout, wow_closing_balance, wow_opening_balance};
use crate::banks::helpers::{
    first_not_none, label_range_period, label_single_amount, label_single_date_end,
    summary_table_column, top_range_end, top_range_period_with_chars,
};

pub struct IdfcDefaultHandler;

impl BankHandler for IdfcDefaultHandler {
    fn mail_subjects(&self) -> Vec<String> {
        vec!["Credit Card Statement".to_string()]
    }

    fn get_statement_date(&self, _text: &str) -> Option<NaiveDate> {
        None
    }

    fn get_statement_period(&self, text: &str) -> (Option<NaiveDate>, Option<NaiveDate>) {
        CreditCardHandler::default_statement_period(text, self.get_statement_date(text))
    }

    fn get_opening_balance(&self, text: &str) -> Option<String> {
        summary_table_column(text, "STATEMENT SUMMARY", "Opening Balance", 2000)
    }

    fn get_closing_balance(&self, text: &str) -> Option<String> {
        label_single_amount(text, "Total Amount Due")
    }
}

pub struct IdfcWowHandler;

impl BankHandler for IdfcWowHandler {
    fn mail_subjects(&self) -> Vec<String> {
        vec![
            "FIRST WOW! Credit Card Statement".to_string(),
            "FIRST WOW Credit Card Statement".to_string(),
            "Your Credit Card Statement".to_string(),
        ]
    }

    fn trim_end(&self) -> Vec<&'static str> {
        vec!["IMPORTANT INFORMATION"]
    }

    fn drop_sections(&self) -> Vec<&'static str> {
        vec![
            "Payment Modes",
            "PAYMENT MODES",
            "Pay via our new Mobile App",
            "Need help Check out our FAQs",
            "Pay Now        Pay in EMI",
            "3X rewards on UPI",
            "Refer this Credit Card",
            "CHECK OUT WHY",
            "Covert your IDFC FIRST Bank Credit Card",
            "Late payment fee would be levied if Minimum",
            "SPECIAL BENEFITS ON YOUR CARD",
            "OFFER OF THE MONTH",
            "YOU MADE A GREAT CHOICE",
            "Enjoy the Convenience",
            "Your Card Information",
        ]
    }

    fn get_statement_date(&self, text: &str) -> Option<NaiveDate> {
        first_not_none([
            label_single_date_end(text, "Statement Date"),
            top_range_end(text, " - ", 500),
        ])
    }

    fn get_statement_period(&self, text: &str) -> (Option<NaiveDate>, Option<NaiveDate>) {
        let (start, end) = label_range_period(text, "Statement Date", " to ");
        if start.is_some() && end.is_some() {
            return (start, end);
        }
        let (start, end) = top_range_period_with_chars(text, " - ", 500);
        if start.is_some() && end.is_some() {
            return (start, end);
        }
        let (start, end) = label_range_period(text, "Statement Period", " - ");
        if start.is_some() && end.is_some() {
            return (start, end);
        }
        CreditCardHandler::default_statement_period(text, self.get_statement_date(text))
    }

    fn get_opening_balance(&self, text: &str) -> Option<String> {
        let normalized = normalize_cr_dr_layout(text);
        wow_opening_balance(&normalized)
    }

    fn get_closing_balance(&self, text: &str) -> Option<String> {
        let normalized = normalize_cr_dr_layout(text);
        wow_closing_balance(&normalized)
    }
}
