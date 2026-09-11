use chrono::NaiveDate;

use super::base::CreditCardHandler;
use crate::banks::helpers::{
    context_range_end, context_range_period, first_not_none, label_range_end, label_range_period,
    label_single_date_end, top_range_end, top_range_period_with_chars,
};

pub fn context_range_statement_date(text: &str, context: &str, joiner: &str) -> Option<NaiveDate> {
    context_range_end(text, context, joiner)
}

pub fn context_range_statement_period(
    text: &str,
    context: &str,
    joiner: &str,
) -> (Option<NaiveDate>, Option<NaiveDate>) {
    let (start, end) = context_range_period(text, context, joiner);
    if start.is_some() && end.is_some() {
        return (start, end);
    }
    let end = context_range_statement_date(text, context, joiner);
    CreditCardHandler::default_statement_period(text, end)
}

pub fn top_range_statement_date(
    text: &str,
    joiner: &str,
    search_chars: usize,
) -> Option<NaiveDate> {
    top_range_end(text, joiner, search_chars)
}

pub fn top_range_statement_period(
    text: &str,
    joiner: &str,
    search_chars: usize,
) -> (Option<NaiveDate>, Option<NaiveDate>) {
    let (start, end) = top_range_period_with_chars(text, joiner, search_chars);
    if start.is_some() && end.is_some() {
        return (start, end);
    }
    let end = top_range_statement_date(text, joiner, search_chars);
    CreditCardHandler::default_statement_period(text, end)
}

pub fn bob_statement_date(text: &str) -> Option<NaiveDate> {
    first_not_none([
        label_single_date_end(text, "Statement Date :"),
        label_range_end(text, "Statement Period :", " to "),
        top_range_end(text, " To ", 500),
    ])
}

pub fn bob_statement_period(text: &str) -> (Option<NaiveDate>, Option<NaiveDate>) {
    let (start, end) = label_range_period(text, "Statement Period :", " to ");
    if start.is_some() && end.is_some() {
        return (start, end);
    }
    let (start, end) = top_range_period_with_chars(text, " To ", 500);
    if start.is_some() && end.is_some() {
        return (start, end);
    }
    let end = bob_statement_date(text);
    CreditCardHandler::default_statement_period(text, end)
}
