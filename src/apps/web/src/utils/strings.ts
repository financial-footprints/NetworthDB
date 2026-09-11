export function toTitleCase(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function capitalize(variant: string | null): string | null {
  if (!variant) return null;
  return variant.toLowerCase().split("-").map(toTitleCase).join(" ");
}
