const DURATION_PATTERN = /^(\d+)(ms|s|m|h)$/;

export function emptyToUndefined(value: unknown): unknown {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }

  return value;
}

export function parseCommaSeparatedValue(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function formatEnvUrlOriginPath(parsed: URL): string {
  const pathname = parsed.pathname.replace(/\/+$/, "");
  return `${parsed.origin}${pathname}`;
}

export function parseDurationValue(value: string): number {
  const match = DURATION_PATTERN.exec(value.trim());

  if (!match) {
    throw new Error(`bootstrap.config.env.invalid-duration.value.${value}`);
  }

  const amount = Number(match[1]);
  const unit = match[2];

  switch (unit) {
    case "ms":
      return amount;
    case "s":
      return amount * 1000;
    case "m":
      return amount * 60 * 1000;
    case "h":
      return amount * 60 * 60 * 1000;
    default:
      throw new Error(`bootstrap.config.env.invalid-duration.unit.${unit}`);
  }
}

export function parseBoundedInt(stringValue: string, min: number, errorKey: string): number {
  const parsed = Number.parseInt(stringValue, 10);
  if (!Number.isInteger(parsed) || parsed < min) {
    throw new Error(`bootstrap.config.env.${errorKey}.value.${stringValue}`);
  }

  return parsed;
}
