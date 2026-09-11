//! Converts vault JSON and internal enums to domain read models.

use super::{
    Account, BalanceGap, Bank, CoverageGap, CoverageSegment, Source, SourceNapi, Statement,
    StatementCoverage, StatementKind, StatementList,
};
use crate::pipeline::metadata::{compute_balance_gaps, covered_month, StoredAccountMetadata};

pub fn account_vault_stub(id: &str, account_type: &str, passwords: Vec<String>) -> Account {
    Account {
        id: id.to_string(),
        user_id: String::new(),
        account_type: account_type.to_string(),
        bank: String::new(),
        variant: None,
        label: String::new(),
        opening_date: String::new(),
        closing_date: None,
        account_number: String::new(),
        passwords,
        mail: None,
        statement: None,
        created_at: String::new(),
        updated_at: String::new(),
    }
}

pub fn source_from_napi(input: SourceNapi) -> Result<Source, String> {
    match input.r#type.as_str() {
        "thunderbird" => {
            let profile = input
                .profile
                .filter(|p| !p.trim().is_empty())
                .ok_or_else(|| "core.sources.invalid.profile-required".to_string())?;
            Ok(Source::Thunderbird {
                id: input.id,
                label: input.label,
                profile,
            })
        }
        "email" => {
            let host = input
                .host
                .filter(|h| !h.trim().is_empty())
                .ok_or_else(|| "core.sources.invalid.host-required".to_string())?;
            let username = input
                .username
                .filter(|u| !u.trim().is_empty())
                .ok_or_else(|| "core.sources.invalid.username-required".to_string())?;
            Ok(Source::Email {
                id: input.id,
                label: input.label,
                host,
                port: input.port.unwrap_or(993),
                username,
                password: input.password,
                folder: input.folder.unwrap_or_else(|| "INBOX".to_string()),
                use_ssl: input.use_ssl.unwrap_or(true),
            })
        }
        other => Err(format!("core.sources.invalid.type:{}", other)),
    }
}

pub fn statement_list_from_stored(
    stored: Option<StoredAccountMetadata>,
    account_id: &str,
) -> StatementList {
    match stored {
        None => StatementList {
            available: false,
            statement_count: 0,
            starting: None,
            ending: None,
            formats: vec![],
            coverage: StatementCoverage {
                start: None,
                end: None,
                segments: vec![],
                gaps: vec![],
                months: vec![],
                period_count: 0,
            },
            statements: vec![],
            balance_gaps: vec![],
        },
        Some(meta) => {
            let statements = meta
                .statements
                .iter()
                .map(|s| {
                    let is_annual = s.granularity == "annual";
                    let kind = if is_annual {
                        StatementKind::Annual
                    } else {
                        StatementKind::Monthly
                    };
                    Statement {
                        account_id: account_id.to_string(),
                        kind,
                        period: if is_annual {
                            s.year_key
                                .clone()
                                .unwrap_or_else(|| s.statement_date.clone())
                        } else {
                            covered_month(&s.statement_date)
                        },
                        statement_date: s.statement_date.clone(),
                        formats: s.formats.clone(),
                        period_start: s.period_start.clone(),
                        period_end: s.period_end.clone(),
                    }
                })
                .collect();
            let balance_gaps = compute_balance_gaps(&meta.statements, None)
                .into_iter()
                .map(|(month, status)| BalanceGap { month, status })
                .collect();
            StatementList {
                available: true,
                statement_count: meta.statement_count,
                starting: meta.starting.clone(),
                ending: meta.ending.clone(),
                formats: meta.formats.clone(),
                coverage: StatementCoverage {
                    start: meta.period_covered.start.clone(),
                    end: meta.period_covered.end.clone(),
                    segments: meta
                        .period_covered
                        .segments
                        .iter()
                        .map(|s| CoverageSegment {
                            start: s.start.clone(),
                            end: s.end.clone(),
                            approximate: Some(s.approximate),
                        })
                        .collect(),
                    gaps: meta
                        .period_covered
                        .gaps
                        .iter()
                        .map(|g| CoverageGap {
                            start: g.start.clone(),
                            end: g.end.clone(),
                            balances_match: g.balances_match,
                        })
                        .collect(),
                    months: meta.period_covered.months.clone(),
                    period_count: meta.period_covered.period_count,
                },
                statements,
                balance_gaps,
            }
        }
    }
}

pub fn banks_from_handlers() -> Vec<Bank> {
    crate::banks::handlers::list_banks()
        .into_iter()
        .map(|(key, bank, variant, account_type)| Bank {
            key,
            bank,
            variant,
            account_type,
        })
        .collect()
}
