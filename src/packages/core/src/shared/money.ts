export function parseRupeeToInteger(value: string): number {
  const trimmed = value.trim().replace(/,/g, "");
  if (!trimmed || trimmed === "0" || trimmed === "0.00") {
    return 0;
  }

  const negative = trimmed.startsWith("-");
  const unsigned = negative ? trimmed.slice(1).trim() : trimmed;
  const parts = unsigned.split(".");
  const wholePart = parts[0] ?? "0";
  if (!/^\d+$/.test(wholePart)) {
    throw new Error("invalid money format");
  }

  let frac = parts[1] ?? "";
  if (parts.length > 2) {
    throw new Error("invalid money format");
  }
  if (frac.length > 2) {
    frac = frac.slice(0, 2);
  }
  while (frac.length < 2) {
    frac += "0";
  }

  const whole = Number.parseInt(wholePart, 10);
  const fraction = Number.parseInt(frac, 10);
  const amount = whole * 100 + fraction;
  return negative ? -amount : amount;
}
