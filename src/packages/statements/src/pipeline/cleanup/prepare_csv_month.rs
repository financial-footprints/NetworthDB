use std::collections::HashMap;
use std::path::PathBuf;

use crate::banks::helpers::text_contains_present;
use crate::errors::StageError;
use crate::pipeline::alerts::AlertService;
use crate::pipeline::cleanup::canonical::write_statement_csv;
use crate::pipeline::cleanup::exclusion::statement_should_exclude;
use crate::pipeline::cleanup::grouping::dedupe_paths_by_hash;
use crate::pipeline::cleanup::keeper::{delete_csv_duplicates, select_csv_keeper};
use crate::pipeline::cleanup::models::PreparedStatement;
use crate::pipeline::cleanup::prepare_common::{
    eligible_paths, filter_existing, report_ambiguous_period, unlink_excluded, MonthPrepareInput,
};
use crate::vault::path::statement_relative_path;
use crate::vault::store::exists;

pub fn prepare_csv_month(
    input: &MonthPrepareInput<'_>,
    alerts: &mut AlertService,
) -> Result<(u32, u32, Option<PreparedStatement>), StageError> {
    let MonthPrepareInput {
        staging_dir,
        config,
        month,
        candidates,
        account,
        raw_by_path,
        path_month,
        path_hash,
        path_period_source,
    } = input;
    let path_hash = *path_hash;
    let path_period_source = *path_period_source;
    let existing = filter_existing(candidates);
    if existing.is_empty() {
        return Ok((0, 0, None));
    }

    let unique = dedupe_paths_by_hash(&existing, path_hash)?;
    let period_source_lookup = path_period_source.cloned().unwrap_or_default();
    let hash_lookup = path_hash.cloned().unwrap_or_default();
    let label = format!("{}/{}", account.bank, account.id);
    let csv_relative = statement_relative_path(&account.account_type, &account.id, month, "csv");
    let text_contains = account
        .statement
        .as_ref()
        .map(|s| s.text_contains.clone())
        .unwrap_or_default();

    let excluded: std::collections::HashSet<PathBuf> = unique
        .iter()
        .filter(|path| {
            statement_should_exclude(
                raw_by_path
                    .and_then(|lookup| lookup.get(*path))
                    .map(|s| s.as_str())
                    .unwrap_or(""),
                raw_by_path
                    .and_then(|lookup| lookup.get(*path))
                    .map(|s| s.as_str())
                    .unwrap_or(""),
                account,
                false,
            )
        })
        .cloned()
        .collect();
    unlink_excluded(&unique, &|path| excluded.contains(path));

    let eligible = eligible_paths(&unique, &|path| !excluded.contains(path));
    if eligible.is_empty() {
        return Ok((0, 1, None));
    }

    let empty_raw = HashMap::new();
    let raw_lookup = raw_by_path.unwrap_or(&empty_raw);
    let (keeper, ambiguous_paths) = select_csv_keeper(
        &eligible,
        raw_lookup,
        &period_source_lookup,
        &hash_lookup,
        &text_contains,
    )?;

    if !ambiguous_paths.is_empty() {
        report_ambiguous_period(
            "CSV",
            &label,
            month,
            &ambiguous_paths,
            &period_source_lookup,
            &text_contains,
            alerts,
        );
        return Ok((0, 1, None));
    }

    if keeper.is_none() {
        for path in &eligible {
            if !text_contains.is_empty()
                && !text_contains_present(
                    raw_by_path
                        .and_then(|lookup| lookup.get(path))
                        .map(|s| s.as_str())
                        .unwrap_or(""),
                    &text_contains,
                )
            {
                alerts.emit(crate::pipeline::alerts::Alert {
                    kind: crate::pipeline::alerts::AlertKind::TextContainsMissing,
                    message: format!(
                        "text_contains {:?} not found in {}",
                        text_contains,
                        path.file_name().unwrap_or_default().to_string_lossy()
                    ),
                    account: label.clone(),
                    source_file: path
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string(),
                    text_contains: text_contains.clone(),
                });
            }
        }
        return Ok((0, 1, None));
    }

    let keeper = keeper.unwrap();
    let extra = candidates.iter().filter(|path| path.is_file()).count();
    if extra == 0 && exists(config, &csv_relative) {
        return Ok((0, 0, None));
    }

    let dedupe_lookup = path_month.cloned().unwrap_or_else(|| {
        unique
            .iter()
            .map(|path| (path.clone(), month.to_string()))
            .collect()
    });
    delete_csv_duplicates(
        staging_dir,
        month,
        &dedupe_lookup,
        Some(&keeper),
        path_hash,
        path_period_source,
    )?;
    let prepared = write_statement_csv(config, staging_dir, account, month, &keeper)?;
    Ok((1, 0, Some(prepared)))
}
