export function apiOrigin(): string {
  return (import.meta.env.PUBLIC_API_ORIGIN ?? "").trim().replace(/\/$/, "");
}
