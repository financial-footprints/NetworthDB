mod amounts;
mod dates;
mod edge;
mod tables;
mod text;

pub use amounts::{
    amounts_with_positions, balances_match, first_amount_in_text, first_not_none,
    parse_amount_string,
};
pub use dates::{
    context_range_end, context_range_period, date_after_label, find_label, label_range_end,
    label_range_period, label_regex, label_single_date_end, line_remainder_after_label,
    parse_date_string, top_range_end, top_range_period, top_range_period_with_chars,
};
pub use edge::inject_edge_summary_labels;

#[cfg(test)]
mod test_edge;
pub use tables::{
    edge_summary_closing, edge_summary_opening, equation_first_after, label_next_line_amount,
    label_single_amount, single_amount_after, summary_table_column, summary_table_row,
    total_outstanding_section_amount,
};
pub use text::{
    purge_drop_sections, sanitize_statement_text, statement_text_eligible, text_contains_present,
    text_not_contains_violated, trim_by_markers,
};
