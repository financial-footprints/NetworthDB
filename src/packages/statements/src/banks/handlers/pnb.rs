use chrono::NaiveDate;

use super::base::BankHandler;
use super::pnb_layouts;

pub struct PnbHandler;

impl BankHandler for PnbHandler {
    fn mail_subjects(&self) -> Vec<String> {
        vec!["Your PNB Credit Card Statement for the month".to_string()]
    }

    fn trim_end(&self) -> Vec<&'static str> {
        vec!["********** End of Statement **********"]
    }

    fn drop_sections(&self) -> Vec<&'static str> {
        pnb_layouts::DROP_SECTIONS.to_vec()
    }

    fn clean_text(&self, raw: &str) -> String {
        pnb_layouts::clean_text(raw)
    }

    fn get_statement_date(&self, text: &str) -> Option<NaiveDate> {
        pnb_layouts::get_statement_date(text)
    }

    fn get_statement_period(&self, text: &str) -> (Option<NaiveDate>, Option<NaiveDate>) {
        pnb_layouts::get_statement_period(text)
    }

    fn get_opening_balance(&self, text: &str) -> Option<String> {
        pnb_layouts::get_opening_balance(text)
    }

    fn get_closing_balance(&self, text: &str) -> Option<String> {
        pnb_layouts::get_closing_balance(text)
    }
}

pub struct PnbPlatinumHandler;

impl BankHandler for PnbPlatinumHandler {
    fn mail_subjects(&self) -> Vec<String> {
        PnbHandler.mail_subjects()
    }
    fn trim_end(&self) -> Vec<&'static str> {
        PnbHandler.trim_end()
    }
    fn drop_sections(&self) -> Vec<&'static str> {
        PnbHandler.drop_sections()
    }
    fn clean_text(&self, raw: &str) -> String {
        PnbHandler.clean_text(raw)
    }
    fn get_statement_date(&self, text: &str) -> Option<NaiveDate> {
        PnbHandler.get_statement_date(text)
    }
    fn get_statement_period(&self, text: &str) -> (Option<NaiveDate>, Option<NaiveDate>) {
        PnbHandler.get_statement_period(text)
    }
    fn get_opening_balance(&self, text: &str) -> Option<String> {
        PnbHandler.get_opening_balance(text)
    }
    fn get_closing_balance(&self, text: &str) -> Option<String> {
        PnbHandler.get_closing_balance(text)
    }
}
