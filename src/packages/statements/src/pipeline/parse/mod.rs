//! Parse statement text into transactions CSV.

use rust_decimal::Decimal;

use crate::banks::parsers::get_parser;
use crate::domain::Account;
use crate::errors::StageError;
use crate::pipeline::cleanup::models::PreparedStatement;
use crate::pipeline::context::RunContext;
use crate::vault::path::{
    list_monthly_pdf_relatives, statement_txt_relative, transactions_csv_relative,
};
use crate::vault::store::{read_bytes, write_bytes, FileStoreConfig};

fn format_amount(value: Decimal) -> String {
    format!("{:.2}", value)
}

fn write_transactions_csv(
    path_relative: &str,
    config: &FileStoreConfig,
    rows: &[crate::banks::parsers::Transaction],
) -> Result<(), StageError> {
    let mut sorted = rows.to_vec();
    sorted.sort_by(|a, b| {
        a.date
            .cmp(&b.date)
            .then_with(|| a.source_file.cmp(&b.source_file))
            .then_with(|| a.description.cmp(&b.description))
    });

    let mut lines = vec!["Date,Description,Ref,Credited,Debited,File".to_string()];
    for txn in &sorted {
        lines.push(format!(
            "{},{},{},{},{},{}",
            txn.date.format("%Y-%m-%d"),
            escape_csv(&txn.description),
            txn.ref_no.as_deref().unwrap_or(""),
            format_amount(txn.credited),
            format_amount(txn.debited),
            escape_csv(&txn.source_file),
        ));
    }
    let body = lines.join("\n") + "\n";
    write_bytes(config, path_relative, body.as_bytes())
        .map_err(|e| StageError::new(e.to_string()))?;
    Ok(())
}

fn escape_csv(value: &str) -> String {
    if value.contains(',') || value.contains('"') || value.contains('\n') {
        format!("\"{}\"", value.replace('"', "\"\""))
    } else {
        value.to_string()
    }
}

pub fn run_account_parse(
    config: &FileStoreConfig,
    account: &Account,
    financial_year: Option<&str>,
    prepared: &[PreparedStatement],
    run_ctx: &RunContext,
) -> Result<u32, StageError> {
    if run_ctx.trace_enabled() {
        run_ctx.trace_info(
            "parse",
            "parse stage started",
            Some(serde_json::json!({
                "accountId": account.id,
                "preparedCount": prepared.len(),
            })),
        );
    }
    let parser = get_parser(&account.bank, account.variant.as_deref())?;
    let mut total = 0u32;
    let mut parsed_periods = std::collections::BTreeSet::new();

    for stmt in prepared {
        if stmt.pdf_bytes.is_none() && stmt.source_csv.is_none() {
            continue;
        }
        let period = stmt.period.clone();
        if parsed_periods.contains(&period) {
            continue;
        }
        parsed_periods.insert(period.clone());
        let source_file = format!("{}.pdf", period);
        let rows = parser.parse(&stmt.cleaned_text, &source_file);
        let csv_relative = transactions_csv_relative(&account.account_type, &account.id, &period);
        write_transactions_csv(&csv_relative, config, &rows)?;
        total += rows.len() as u32;
    }

    for pdf_relative in
        list_monthly_pdf_relatives(config, &account.account_type, &account.id, financial_year)
            .map_err(|e| StageError::new(e.to_string()))?
    {
        let stem = pdf_relative
            .rsplit('/')
            .next()
            .and_then(|name| name.strip_suffix(".pdf"))
            .unwrap_or("");
        if crate::period::parse_month_period(stem).is_none() {
            continue;
        }
        if parsed_periods.contains(stem) {
            continue;
        }
        let txt_relative = statement_txt_relative(&account.account_type, &account.id, stem);
        let bytes = read_bytes(config, &txt_relative)
            .map_err(|e| StageError::new(e.to_string()))?
            .ok_or_else(|| StageError::new(format!("missing txt: {}", txt_relative)))?;
        let text = String::from_utf8_lossy(&bytes);
        let source_file = format!("{}.pdf", stem);
        let rows = parser.parse(&text, &source_file);
        let csv_relative = transactions_csv_relative(&account.account_type, &account.id, stem);
        write_transactions_csv(&csv_relative, config, &rows)?;
        total += rows.len() as u32;
    }

    if run_ctx.trace_enabled() {
        run_ctx.trace_info(
            "parse",
            "parse stage completed",
            Some(serde_json::json!({
                "accountId": account.id,
                "rowCount": total,
                "parsedPeriods": parsed_periods.iter().collect::<Vec<_>>(),
            })),
        );
    }

    Ok(total)
}
