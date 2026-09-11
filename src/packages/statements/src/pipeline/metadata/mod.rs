//! Account metadata build and persist (Phase 4).

pub mod coverage;
pub mod stored;

pub use coverage::{compute_balance_gaps, covered_month};
pub use stored::{
    CoverageGap, CoverageSegment, PeriodCovered, StatementMetadata, StoredAccountMetadata,
};

use chrono::{Datelike, NaiveDate};

use crate::banks::handlers::get_handler;
use crate::domain::Account;
use crate::errors::StageError;
use crate::period::parse_month_period;
use crate::pipeline::cleanup::models::PreparedStatement;
use crate::pipeline::context::RunContext;
use crate::vault::path::{
    account_metadata_relative, list_monthly_pdf_relatives, statement_txt_relative,
    transactions_csv_relative,
};
use crate::vault::store::{read_bytes, write_bytes, FileStoreConfig};

#[derive(Debug, Clone)]
pub struct ApiMonthMetadata {
    pub month: String,
    pub statement_date: String,
    pub formats: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct ApiAccountMetadata {
    pub metadata_available: bool,
    pub statement_count: u32,
    pub starting: Option<String>,
    pub ending: Option<String>,
    pub formats: Vec<String>,
    pub period_covered: PeriodCovered,
    pub months: Vec<ApiMonthMetadata>,
    pub balance_gaps: Vec<(String, String)>,
    pub annual_statements: Vec<ApiAnnualStatement>,
}

#[derive(Debug, Clone)]
pub struct ApiAnnualStatement {
    pub year_key: String,
    pub statement_date: String,
    pub label: String,
    pub period_start: String,
    pub period_end: String,
    pub formats: Vec<String>,
}

fn format_account_date(date: NaiveDate) -> String {
    format!("{:02}-{:02}-{:04}", date.day(), date.month(), date.year())
}

fn resolve_period_bounds(text: &str, account: &Account) -> (Option<String>, Option<String>, bool) {
    let handler = get_handler(&account.bank, account.variant.as_deref()).expect("handler");
    let (mut start, mut end) = handler.get_statement_period(text);
    if start.is_some() && end.is_some() {
        if let (Some(s), Some(e)) = (start, end) {
            if s > e {
                start = Some(e);
                end = Some(s);
            }
        }
        return (
            start.map(format_account_date),
            end.map(format_account_date),
            false,
        );
    }
    if end.is_none() {
        return (None, None, false);
    }
    let end_date = end.unwrap();
    let approx_start = crate::period::approx_start_from_end(end_date);
    (
        Some(format_account_date(approx_start)),
        Some(format_account_date(end_date)),
        true,
    )
}

pub fn build_account_metadata(
    config: &FileStoreConfig,
    account: &Account,
    financial_year: Option<&str>,
    prepared: &[PreparedStatement],
) -> Result<StoredAccountMetadata, StageError> {
    let mut statements = Vec::new();
    let mut account_formats = std::collections::BTreeSet::new();
    let mut seen_periods = std::collections::BTreeSet::new();

    for prepared_stmt in prepared {
        if prepared_stmt.pdf_bytes.is_some() {
            seen_periods.insert(prepared_stmt.period.clone());
            let statement_date = prepared_stmt.period.clone();
            let handler = get_handler(&account.bank, account.variant.as_deref())?;
            let opening = handler.get_opening_balance(&prepared_stmt.cleaned_text);
            let closing = handler.get_closing_balance(&prepared_stmt.cleaned_text);
            let (period_start, period_end, period_approximate) =
                resolve_period_bounds(&prepared_stmt.cleaned_text, account);
            let mut formats = vec!["pdf".to_string(), "txt".to_string()];
            if prepared_stmt.source_csv.is_some() {
                formats.push("csv".to_string());
            }
            account_formats.extend(formats.clone());
            statements.push(StatementMetadata {
                statement_date,
                formats,
                opening_balance: opening,
                closing_balance: closing,
                period_start,
                period_end,
                period_approximate,
                granularity: "monthly".to_string(),
                covered_months: vec![covered_month(&prepared_stmt.period)],
                year_key: None,
            });
        }
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
        if parse_month_period(stem).is_none() {
            continue;
        }
        let statement_date = stem.to_string();
        if seen_periods.contains(&statement_date) {
            continue;
        }
        let txt_relative =
            statement_txt_relative(&account.account_type, &account.id, &statement_date);
        let txt_bytes =
            read_bytes(config, &txt_relative).map_err(|e| StageError::new(e.to_string()))?;
        let (opening, closing, period_start, period_end, period_approximate) =
            if let Some(bytes) = txt_bytes {
                let text = String::from_utf8_lossy(&bytes);
                let handler = get_handler(&account.bank, account.variant.as_deref())?;
                let opening = handler.get_opening_balance(&text);
                let closing = handler.get_closing_balance(&text);
                let (ps, pe, approx) = resolve_period_bounds(&text, account);
                (opening, closing, ps, pe, approx)
            } else {
                (None, None, None, None, false)
            };

        let mut formats = vec!["pdf".to_string()];
        if read_bytes(config, &txt_relative)
            .map_err(|e| StageError::new(e.to_string()))?
            .is_some()
        {
            formats.push("txt".to_string());
        }
        let tx_csv = transactions_csv_relative(&account.account_type, &account.id, &statement_date);
        if read_bytes(config, &tx_csv)
            .map_err(|e| StageError::new(e.to_string()))?
            .is_some()
        {
            formats.push("csv".to_string());
        }
        account_formats.extend(formats.clone());

        statements.push(StatementMetadata {
            statement_date,
            formats,
            opening_balance: opening,
            closing_balance: closing,
            period_start,
            period_end,
            period_approximate,
            granularity: "monthly".to_string(),
            covered_months: vec![covered_month(stem)],
            year_key: None,
        });
    }

    statements.sort_by(|a, b| a.statement_date.cmp(&b.statement_date));
    let statement_dates = statements
        .iter()
        .map(|s| s.statement_date.clone())
        .collect::<Vec<_>>();

    let period_covered = coverage::build_period_covered(&statements, None);

    let starting = statement_dates.first().cloned();
    let ending = statement_dates.last().cloned();
    let statement_count = statement_dates.len() as u32;

    Ok(StoredAccountMetadata {
        account_id: account.id.clone(),
        bank: account.bank.clone(),
        variant: account.variant.clone(),
        account_type: account.account_type.clone(),
        opening_date: Some(account.opening_date.clone()),
        closing_date: account.closing_date.clone(),
        formats: account_formats.into_iter().collect(),
        statements,
        statement_dates,
        starting,
        ending,
        statement_count,
        period_covered,
        last_fetch_date: None,
    })
}

pub fn write_account_metadata(
    config: &FileStoreConfig,
    account: &Account,
    metadata: &StoredAccountMetadata,
) -> Result<(), StageError> {
    let relative = account_metadata_relative(&account.account_type, &account.id);
    let json =
        serde_json::to_string_pretty(metadata).map_err(|e| StageError::new(e.to_string()))?;
    write_bytes(config, &relative, json.as_bytes()).map_err(|e| StageError::new(e.to_string()))?;
    Ok(())
}

pub fn read_last_fetch_date(
    config: &FileStoreConfig,
    account: &Account,
) -> Result<Option<chrono::NaiveDate>, StageError> {
    let relative = account_metadata_relative(&account.account_type, &account.id);
    let bytes = read_bytes(config, &relative).map_err(|e| StageError::new(e.to_string()))?;
    let Some(bytes) = bytes else {
        return Ok(None);
    };
    let payload: serde_json::Value =
        serde_json::from_slice(&bytes).map_err(|e| StageError::new(e.to_string()))?;
    let value = payload.get("last_fetch_date").and_then(|v| v.as_str());
    Ok(value.and_then(crate::period::parse_account_date_str))
}

pub fn write_last_fetch_date(
    config: &FileStoreConfig,
    account: &Account,
    fetch_date: chrono::NaiveDate,
) -> Result<(), StageError> {
    let relative = account_metadata_relative(&account.account_type, &account.id);
    let formatted = crate::period::format_account_date(fetch_date);
    let mut payload: serde_json::Map<String, serde_json::Value> = if let Some(bytes) =
        read_bytes(config, &relative).map_err(|e| StageError::new(e.to_string()))?
    {
        serde_json::from_slice(&bytes).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    }
    .as_object()
    .cloned()
    .unwrap_or_default();
    payload.insert(
        "last_fetch_date".to_string(),
        serde_json::Value::String(formatted),
    );
    let json = serde_json::to_string_pretty(&serde_json::Value::Object(payload))
        .map_err(|e| StageError::new(e.to_string()))?;
    write_bytes(config, &relative, json.as_bytes()).map_err(|e| StageError::new(e.to_string()))?;
    Ok(())
}

pub fn refresh_account_metadata(
    config: &FileStoreConfig,
    account: &Account,
    financial_year: Option<&str>,
    prepared: &[PreparedStatement],
    run_ctx: &RunContext,
) -> Result<(), StageError> {
    if run_ctx.trace_enabled() {
        run_ctx.trace_info(
            "metadata",
            "metadata refresh started",
            Some(serde_json::json!({
                "accountId": account.id,
                "preparedCount": prepared.len(),
            })),
        );
    }
    let preserved_last_fetch =
        read_last_fetch_date(config, account)?.map(crate::period::format_account_date);
    let mut metadata = build_account_metadata(config, account, financial_year, prepared)?;
    if let Some(last_fetch) = preserved_last_fetch {
        metadata.last_fetch_date = Some(last_fetch);
    }
    write_account_metadata(config, account, &metadata)?;
    if run_ctx.trace_enabled() {
        run_ctx.trace_info(
            "metadata",
            "metadata refresh completed",
            Some(serde_json::json!({
                "accountId": account.id,
                "statementCount": metadata.statements.len(),
            })),
        );
    }
    Ok(())
}

pub fn read_stored_metadata(
    config: &FileStoreConfig,
    account: &Account,
) -> Option<StoredAccountMetadata> {
    let relative = account_metadata_relative(&account.account_type, &account.id);
    let bytes = read_bytes(config, &relative).ok().flatten()?;
    serde_json::from_slice(&bytes).ok()
}

pub fn to_api_metadata(stored: Option<StoredAccountMetadata>) -> ApiAccountMetadata {
    match stored {
        None => ApiAccountMetadata {
            metadata_available: false,
            statement_count: 0,
            starting: None,
            ending: None,
            formats: vec![],
            period_covered: PeriodCovered {
                start: None,
                end: None,
                segments: vec![],
                gaps: vec![],
                months: vec![],
                period_count: 0,
            },
            months: vec![],
            balance_gaps: vec![],
            annual_statements: vec![],
        },
        Some(meta) => {
            let months = meta
                .statements
                .iter()
                .map(|s| ApiMonthMetadata {
                    month: covered_month(&s.statement_date),
                    statement_date: s.statement_date.clone(),
                    formats: s.formats.clone(),
                })
                .collect();
            ApiAccountMetadata {
                metadata_available: true,
                statement_count: meta.statement_count,
                starting: meta.starting.clone(),
                ending: meta.ending.clone(),
                formats: meta.formats.clone(),
                period_covered: meta.period_covered.clone(),
                months,
                balance_gaps: coverage::compute_balance_gaps(&meta.statements, None),
                annual_statements: meta
                    .statements
                    .iter()
                    .filter(|s| s.granularity == "annual")
                    .map(|s| ApiAnnualStatement {
                        year_key: s
                            .year_key
                            .clone()
                            .unwrap_or_else(|| s.statement_date.clone()),
                        statement_date: s.statement_date.clone(),
                        label: s.statement_date.clone(),
                        period_start: s.period_start.clone().unwrap_or_default(),
                        period_end: s.period_end.clone().unwrap_or_default(),
                        formats: s.formats.clone(),
                    })
                    .collect(),
            }
        }
    }
}
