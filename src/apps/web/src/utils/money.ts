export { parseRupeeToInteger } from "@ndb/platform";

export function formatIntegerAsRupee(minor: number): string {
  const negative = minor < 0;
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const fracStr = frac.toString().padStart(2, "0");
  const body = `${whole}.${fracStr}`;
  return negative ? `-${body}` : body;
}
