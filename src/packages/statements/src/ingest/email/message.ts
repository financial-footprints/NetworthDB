const UNSAFE_CHARS = /[<>:/\\|?*]+/g;

export function sanitizeFilename(name: string): string {
  const leaf = name.split(/[/\\]/).pop() ?? "attachment";
  const cleaned = leaf.trim().replace(UNSAFE_CHARS, "_");
  return cleaned.length > 0 ? cleaned : "attachment";
}

export function subjectMatches(subject: string, subjects: string[]): boolean {
  const lowered = subject.toLowerCase();
  return subjects.some((entry) => entry.length > 0 && lowered.includes(entry.toLowerCase()));
}

export function bodyMatches(
  body: string,
  attachmentNames: string[],
  bodyContains: string[]
): boolean {
  if (bodyContains.length === 0) {
    return true;
  }
  const haystack = `${body}\n${attachmentNames.join("\n")}`.toLowerCase();
  return bodyContains.some((entry) => entry.length > 0 && haystack.includes(entry.toLowerCase()));
}

export function fromMatches(from: string, fromFilters: string[]): boolean {
  if (fromFilters.length === 0) {
    return true;
  }
  const lowered = from.toLowerCase();
  for (const entry of fromFilters) {
    if (entry.includes("@")) {
      if (lowered.includes(entry.toLowerCase())) {
        return true;
      }
    } else {
      const needle = `@${entry.toLowerCase()}`;
      if (lowered.includes(needle)) {
        return true;
      }
    }
  }
  return false;
}

export function messageInDateRange(
  received: Date | null,
  startDate: Date | null,
  endDate: Date | null
): boolean {
  if (!received) {
    return false;
  }

  const msgMonth = new Date(received.getFullYear(), received.getMonth(), 1);
  if (startDate) {
    const rangeStart = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    if (msgMonth < rangeStart) {
      return false;
    }
  }
  if (endDate) {
    const rangeEnd = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    if (msgMonth > rangeEnd) {
      return false;
    }
  }
  return true;
}
