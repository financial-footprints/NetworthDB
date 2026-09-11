#![cfg(feature = "napi")]

use crate::domain::{
    Account, AccountTransactions, Bank, JobScope, ProcessResult, SourceNapi, StatementKind,
    StatementList, StatementsRun,
};

use super::types::{
    Account as WireAccount, AccountTransactions as WireAccountTransactions,
    BalanceGap as WireBalanceGap, Bank as WireBank, CoverageGap as WireCoverageGap,
    CoverageSegment as WireCoverageSegment, JobScope as WireJobScope,
    ProcessResult as WireProcessResult, SourceNapi as WireSourceNapi, Statement as WireStatement,
    StatementCoverage as WireStatementCoverage, StatementKind as WireStatementKind,
    StatementList as WireStatementList, StatementWarning as WireStatementWarning,
    StatementsRun as WireStatementsRun, TransactionRow as WireTransactionRow,
};

fn statement_kind_to_wire(kind: StatementKind) -> WireStatementKind {
    match kind {
        StatementKind::Monthly => WireStatementKind::Monthly,
        StatementKind::Annual => WireStatementKind::Annual,
    }
}

pub fn account_from_wire(input: WireAccount) -> Account {
    Account {
        id: input.id,
        user_id: input.user_id,
        account_type: input.account_type,
        bank: input.bank,
        variant: input.variant,
        label: input.label,
        opening_date: input.opening_date,
        closing_date: input.closing_date,
        account_number: input.account_number,
        passwords: input.passwords,
        mail: input.mail.map(|mail| crate::domain::MailRules {
            subjects: mail.subjects,
            body_contains: mail.body_contains,
            from_addresses: mail.from_addresses,
        }),
        statement: input.statement.map(|rules| crate::domain::StatementRules {
            text_contains: rules.text_contains,
            text_not_contains: rules.text_not_contains,
        }),
        created_at: input.created_at,
        updated_at: input.updated_at,
    }
}

pub fn job_scope_from_wire(scope: WireJobScope) -> JobScope {
    JobScope {
        account_id: scope.account_id,
        financial_year: scope.financial_year,
    }
}

pub fn source_from_wire(input: WireSourceNapi) -> SourceNapi {
    SourceNapi {
        id: input.id,
        r#type: input.r#type,
        label: input.label,
        profile: input.profile,
        host: input.host,
        port: input.port,
        username: input.username,
        password: input.password,
        folder: input.folder,
        use_ssl: input.use_ssl,
    }
}

pub fn statements_run_from_wire(run: WireStatementsRun) -> StatementsRun {
    StatementsRun {
        user_id: run.user_id,
        scope: job_scope_from_wire(run.scope),
        accounts: run.accounts.into_iter().map(account_from_wire).collect(),
        sources: run.sources.into_iter().map(source_from_wire).collect(),
    }
}

pub fn process_result_to_wire(result: ProcessResult) -> WireProcessResult {
    WireProcessResult {
        ok: result.ok,
        reason: result.reason,
        warnings: result
            .warnings
            .into_iter()
            .map(|warning| WireStatementWarning {
                kind: warning.kind,
                message: warning.message,
                account: warning.account,
                source_file: warning.source_file,
                text_contains: warning.text_contains,
            })
            .collect(),
        logs: result.logs,
    }
}

pub fn bank_to_wire(bank: Bank) -> WireBank {
    WireBank {
        key: bank.key,
        bank: bank.bank,
        variant: bank.variant,
        account_type: bank.account_type,
    }
}

pub fn statement_list_to_wire(list: StatementList) -> WireStatementList {
    WireStatementList {
        available: list.available,
        statement_count: list.statement_count,
        starting: list.starting,
        ending: list.ending,
        formats: list.formats,
        coverage: WireStatementCoverage {
            start: list.coverage.start,
            end: list.coverage.end,
            segments: list
                .coverage
                .segments
                .into_iter()
                .map(|segment| WireCoverageSegment {
                    start: segment.start,
                    end: segment.end,
                    approximate: segment.approximate,
                })
                .collect(),
            gaps: list
                .coverage
                .gaps
                .into_iter()
                .map(|gap| WireCoverageGap {
                    start: gap.start,
                    end: gap.end,
                    balances_match: gap.balances_match,
                })
                .collect(),
            months: list.coverage.months,
            period_count: list.coverage.period_count,
        },
        statements: list
            .statements
            .into_iter()
            .map(|statement| WireStatement {
                account_id: statement.account_id,
                kind: statement_kind_to_wire(statement.kind),
                period: statement.period,
                statement_date: statement.statement_date,
                formats: statement.formats,
                period_start: statement.period_start,
                period_end: statement.period_end,
            })
            .collect(),
        balance_gaps: list
            .balance_gaps
            .into_iter()
            .map(|gap| WireBalanceGap {
                month: gap.month,
                status: gap.status,
            })
            .collect(),
    }
}

pub fn account_transactions_to_wire(
    rows: Vec<AccountTransactions>,
) -> Vec<WireAccountTransactions> {
    rows.into_iter()
        .map(|entry| WireAccountTransactions {
            period: entry.period,
            is_annual: entry.is_annual,
            rows: entry
                .rows
                .into_iter()
                .map(|row| WireTransactionRow {
                    date: row.date,
                    description: row.description,
                    ref_no: row.ref_no,
                    credited: row.credited,
                    debited: row.debited,
                    source_file: row.source_file,
                })
                .collect(),
        })
        .collect()
}
