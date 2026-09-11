use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

use crate::banks::handlers::get_handler;
use crate::banks::helpers::text_contains_present;
use crate::banks::period_source::{period_source_for_path, period_source_rank, PeriodSource};
use crate::domain::Account;
use crate::errors::StageError;
use crate::period::email_date_from_staging_filename;
use crate::pipeline::cleanup::grouping::file_hash;
use crate::pipeline::cleanup::staging::{is_staging_csv, is_staging_pdf};
use crate::vault::path::{iter_csvs, iter_pdfs};

pub fn format_ambiguous_candidates(
    paths: &[PathBuf],
    path_period_source: &HashMap<PathBuf, PeriodSource>,
) -> String {
    let mut sorted = paths.to_vec();
    sorted.sort();
    sorted
        .iter()
        .map(|path| {
            format!(
                "{} ({})",
                path.file_name().unwrap_or_default().to_string_lossy(),
                period_source_label(period_source_for_path(path, path_period_source))
            )
        })
        .collect::<Vec<_>>()
        .join(", ")
}

fn period_source_label(source: PeriodSource) -> &'static str {
    match source {
        PeriodSource::Manual => "manual",
        PeriodSource::Annual => "annual",
        PeriodSource::ContentDate => "content_date",
        PeriodSource::FilenameFallback => "filename_fallback",
        PeriodSource::Unknown => "unknown",
    }
}

fn rank_best_by_period_and_hash(
    unique: &[PathBuf],
    text_by_path: &HashMap<PathBuf, String>,
    path_period_source: &HashMap<PathBuf, PeriodSource>,
    path_hash: &HashMap<PathBuf, String>,
    text_contains: &[String],
) -> Result<(Option<PathBuf>, Option<Vec<PathBuf>>), StageError> {
    let matching: Vec<PathBuf> = unique
        .iter()
        .filter(|path| {
            text_by_path
                .get(*path)
                .is_some_and(|text| text_contains_present(text, text_contains))
        })
        .cloned()
        .collect();
    if matching.is_empty() {
        return Ok((None, None));
    }

    let mut matching_sorted = matching;
    matching_sorted.sort_by(|a, b| {
        let rank_a = period_source_rank(period_source_for_path(a, path_period_source));
        let rank_b = period_source_rank(period_source_for_path(b, path_period_source));
        rank_a.cmp(&rank_b).then_with(|| a.cmp(b))
    });
    let best_rank = period_source_rank(period_source_for_path(
        &matching_sorted[0],
        path_period_source,
    ));
    let best: Vec<PathBuf> = matching_sorted
        .iter()
        .filter(|path| {
            period_source_rank(period_source_for_path(path, path_period_source)) == best_rank
        })
        .cloned()
        .collect();
    if best.len() == 1 {
        return Ok((Some(best[0].clone()), None));
    }

    let digests: HashSet<String> = best
        .iter()
        .map(|path| {
            path_hash
                .get(path)
                .cloned()
                .unwrap_or_else(|| file_hash(path).unwrap_or_default())
        })
        .collect();
    if digests.len() == 1 {
        return Ok((Some(best.last().cloned().unwrap()), None));
    }
    Ok((None, Some(best)))
}

pub fn select_keeper(
    unique: &[PathBuf],
    account: &Account,
    sanitized_by_path: &HashMap<PathBuf, String>,
    path_period_source: &HashMap<PathBuf, PeriodSource>,
    path_hash: &HashMap<PathBuf, String>,
    text_contains: &[String],
    manual_candidates: &[PathBuf],
) -> Result<(Option<PathBuf>, Vec<PathBuf>), StageError> {
    if !manual_candidates.is_empty() {
        return Ok((manual_candidates.last().cloned(), vec![]));
    }
    if text_contains.is_empty() {
        return Ok((unique.last().cloned(), vec![]));
    }

    let (resolved, remainder) = rank_best_by_period_and_hash(
        unique,
        sanitized_by_path,
        path_period_source,
        path_hash,
        text_contains,
    )?;
    if remainder.is_none() {
        return Ok((resolved, vec![]));
    }
    let best = remainder.unwrap();
    let keeper = pick_keeper_by_richness_then_email(&best, sanitized_by_path, account)?;
    if keeper.is_none() {
        return Ok((None, best));
    }
    Ok((keeper, vec![]))
}

pub fn select_csv_keeper(
    unique: &[PathBuf],
    raw_by_path: &HashMap<PathBuf, String>,
    path_period_source: &HashMap<PathBuf, PeriodSource>,
    path_hash: &HashMap<PathBuf, String>,
    text_contains: &[String],
) -> Result<(Option<PathBuf>, Vec<PathBuf>), StageError> {
    if unique.is_empty() {
        return Ok((None, vec![]));
    }
    if text_contains.is_empty() {
        return Ok((unique.last().cloned(), vec![]));
    }
    let (resolved, remainder) = rank_best_by_period_and_hash(
        unique,
        raw_by_path,
        path_period_source,
        path_hash,
        text_contains,
    )?;
    if remainder.is_none() {
        return Ok((resolved, vec![]));
    }
    let best = remainder.unwrap();
    let dated: Vec<(PathBuf, chrono::NaiveDate)> = best
        .iter()
        .filter_map(|path| {
            email_date_from_staging_filename(
                &path.file_name().unwrap_or_default().to_string_lossy(),
            )
            .map(|date| (path.clone(), date))
        })
        .collect();
    if !dated.is_empty() {
        let latest = dated.iter().map(|(_, d)| *d).max().unwrap();
        let latest_paths: Vec<PathBuf> = dated
            .iter()
            .filter(|(_, d)| *d == latest)
            .map(|(p, _)| p.clone())
            .collect();
        return Ok((latest_paths.last().cloned(), vec![]));
    }
    let mut preferred = best;
    preferred.sort_by(|a, b| {
        let manual_a = a
            .file_name()
            .map(|n| n.to_string_lossy().starts_with("manual__"))
            .unwrap_or(false);
        let manual_b = b
            .file_name()
            .map(|n| n.to_string_lossy().starts_with("manual__"))
            .unwrap_or(false);
        manual_a.cmp(&manual_b).then_with(|| a.cmp(b))
    });
    Ok((preferred.last().cloned(), vec![]))
}

fn pick_keeper_by_richness_then_email(
    candidates: &[PathBuf],
    sanitized_by_path: &HashMap<PathBuf, String>,
    account: &Account,
) -> Result<Option<PathBuf>, StageError> {
    let handler = get_handler(&account.bank, account.variant.as_deref())?;
    let richness_by_path: HashMap<PathBuf, usize> = candidates
        .iter()
        .map(|path| {
            let text = sanitized_by_path
                .get(path)
                .map(|s| s.as_str())
                .unwrap_or("");
            let score = [
                handler.get_statement_date(text).is_some(),
                handler.get_opening_balance(text).is_some(),
                handler.get_closing_balance(text).is_some(),
            ]
            .iter()
            .filter(|v| **v)
            .count();
            (path.clone(), score)
        })
        .collect();
    let max_richness = richness_by_path.values().copied().max().unwrap_or(0);
    let richest: Vec<PathBuf> = candidates
        .iter()
        .filter(|path| richness_by_path.get(*path).copied().unwrap_or(0) == max_richness)
        .cloned()
        .collect();
    if richest.len() == 1 {
        return Ok(Some(richest[0].clone()));
    }
    let dated: Vec<(PathBuf, chrono::NaiveDate)> = richest
        .iter()
        .filter_map(|path| {
            email_date_from_staging_filename(
                &path.file_name().unwrap_or_default().to_string_lossy(),
            )
            .map(|date| (path.clone(), date))
        })
        .collect();
    let with_dates: Vec<(PathBuf, chrono::NaiveDate)> = dated;
    if with_dates.is_empty() {
        return Ok(None);
    }
    let latest = with_dates.iter().map(|(_, d)| *d).max().unwrap();
    let latest_paths: Vec<PathBuf> = with_dates
        .iter()
        .filter(|(_, d)| *d == latest)
        .map(|(p, _)| p.clone())
        .collect();
    if latest_paths.len() == 1 {
        return Ok(Some(latest_paths[0].clone()));
    }
    Ok(None)
}

struct DuplicateDeleteContext<'a> {
    staging_dir: &'a Path,
    month: &'a str,
    path_month: &'a HashMap<PathBuf, String>,
    iter_paths: fn(&Path) -> Vec<PathBuf>,
    is_staging_file: fn(&Path, &Path) -> bool,
    keep: Option<&'a PathBuf>,
    path_hash: Option<&'a HashMap<PathBuf, String>>,
    path_period_source: Option<&'a HashMap<PathBuf, PeriodSource>>,
}

pub fn delete_pdf_duplicates(
    staging_dir: &Path,
    month: &str,
    path_month: &HashMap<PathBuf, String>,
    keep: Option<&PathBuf>,
    path_hash: Option<&HashMap<PathBuf, String>>,
    path_period_source: Option<&HashMap<PathBuf, PeriodSource>>,
) -> Result<u32, StageError> {
    delete_duplicates(&DuplicateDeleteContext {
        staging_dir,
        month,
        path_month,
        iter_paths: iter_pdfs,
        is_staging_file: is_staging_pdf,
        keep,
        path_hash,
        path_period_source,
    })
}

pub fn delete_csv_duplicates(
    staging_dir: &Path,
    month: &str,
    path_month: &HashMap<PathBuf, String>,
    keep: Option<&PathBuf>,
    path_hash: Option<&HashMap<PathBuf, String>>,
    path_period_source: Option<&HashMap<PathBuf, PeriodSource>>,
) -> Result<u32, StageError> {
    delete_duplicates(&DuplicateDeleteContext {
        staging_dir,
        month,
        path_month,
        iter_paths: iter_csvs,
        is_staging_file: is_staging_csv,
        keep,
        path_hash,
        path_period_source,
    })
}

fn delete_duplicates(ctx: &DuplicateDeleteContext<'_>) -> Result<u32, StageError> {
    let mut removed = 0u32;
    let keep_resolved = ctx.keep.and_then(|path| path.canonicalize().ok());
    let keep_digest = ctx.keep.map(|path| {
        ctx.path_hash
            .and_then(|lookup| lookup.get(path).cloned())
            .unwrap_or_else(|| file_hash(path).unwrap_or_default())
    });
    let keep_rank = ctx.keep.and_then(|path| {
        ctx.path_period_source
            .map(|lookup| period_source_rank(period_source_for_path(path, lookup)))
    });
    for path in (ctx.iter_paths)(ctx.staging_dir) {
        if !(ctx.is_staging_file)(ctx.staging_dir, &path) {
            continue;
        }
        if ctx.path_month.get(&path).map(|m| m.as_str()) != Some(ctx.month) {
            continue;
        }
        if keep_resolved.is_some() && path.canonicalize().ok() == keep_resolved {
            continue;
        }
        if let (Some(rank), Some(lookup)) = (keep_rank, ctx.path_period_source) {
            let path_rank = period_source_rank(period_source_for_path(&path, lookup));
            let path_digest = ctx
                .path_hash
                .and_then(|h| h.get(&path).cloned())
                .unwrap_or_else(|| file_hash(&path).unwrap_or_default());
            if keep_digest.is_some()
                && path_digest != keep_digest.clone().unwrap_or_default()
                && path_rank <= rank
            {
                continue;
            }
        }
        if std::fs::remove_file(&path).is_ok() {
            removed += 1;
        }
    }
    Ok(removed)
}
