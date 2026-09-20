export enum PeriodSource {
  Manual = "manual",
  Annual = "annual",
  ContentDate = "content_date",
  FilenameFallback = "filename_fallback",
  Unknown = "unknown",
}

export function periodSourceRank(source: PeriodSource): number {
  switch (source) {
    case PeriodSource.Manual:
      return -1;
    case PeriodSource.Annual:
      return 0;
    case PeriodSource.ContentDate:
      return 1;
    case PeriodSource.FilenameFallback:
      return 2;
    case PeriodSource.Unknown:
      return 3;
    default:
      return 3;
  }
}

export function periodSourceForPath(
  filePath: string,
  lookup: Map<string, PeriodSource>
): PeriodSource {
  const fromLookup = lookup.get(filePath);
  if (fromLookup) {
    return fromLookup;
  }

  const name = filePath.split(/[/\\]/).pop() ?? "";
  if (name.startsWith("manual__")) {
    return PeriodSource.Manual;
  }
  return PeriodSource.Unknown;
}
