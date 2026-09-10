export function requireEnv(name: string): string {
  const value = process.env[name];

  if (value === undefined || value.trim() === "") {
    throw new Error(`bootstrap.config.env.required.not-found.${name}`);
  }

  return value;
}

export function optionalEnv(name: string): string | undefined {
  const value = process.env[name];

  if (value === undefined || value.trim() === "") {
    return undefined;
  }

  return value;
}

export function requirePort(name: string): number {
  const value = requireEnv(name);
  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`bootstrap.config.env.invalid-port.value.${value}`);
  }

  return port;
}

const DURATION_PATTERN = /^(\d+)(ms|s|m|h)$/;

export function requireDuration(name: string): number {
  const value = requireEnv(name);
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

export function parseCorsOrigins(value: string | undefined): string[] {
  if (value === undefined) {
    return [];
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
