import type { SourceConfig } from "@web/utils/api/endpoints/sources/types";

export function validateSource(source: SourceConfig): string[] {
  if (source.type === "thunderbird") {
    if (!source.profile.trim()) {
      return ["Thunderbird Profile Path is required."];
    }
    return [];
  }
  const errors: string[] = [];
  if (!source.host.trim()) {
    errors.push("Host is required.");
  }
  if (!source.username.trim()) {
    errors.push("Username is required.");
  }
  if (!source.password?.trim() && !source.has_password) {
    errors.push("Password is required for new email sources.");
  }
  return errors;
}

export function validateSources(sources: SourceConfig[]): string | null {
  for (const source of sources) {
    const errors = validateSource(source);
    if (errors.length > 0) {
      return errors[0];
    }
  }
  return null;
}
