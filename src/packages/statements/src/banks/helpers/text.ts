const DISALLOWED = /[^A-Za-z0-9 \n\r.,/\-:()%&@#*+=<>|_$]/g;

function normalizeLine(line: string): string {
  return line.replace(/\t/g, " ").trimEnd();
}

export function sanitizeStatementText(raw: string): string {
  const cleaned = raw.replace(DISALLOWED, " ");
  return cleaned.split("\n").map(normalizeLine).join("\n");
}

export function trimByMarkers(raw: string, trimStart: string[], trimEnd: string[]): string {
  const lines = raw.split("\n");
  let startIdx = 0;

  if (trimStart.length > 0) {
    const found = lines
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => trimStart.some((marker) => line.includes(marker)))
      .map(({ index }) => index);
    if (found.length > 0) {
      startIdx = Math.min(...found);
    }
  }

  let endIdx = lines.length;
  if (trimEnd.length > 0) {
    const found = lines
      .map((line, index) => ({ line, index }))
      .slice(startIdx)
      .filter(({ line }) => trimEnd.some((marker) => line.includes(marker)))
      .map(({ index }) => index);
    if (found.length === 0) {
      if (lines.some((line) => trimEnd.some((marker) => line.includes(marker)))) {
        return "";
      }
    } else {
      endIdx = Math.max(...found) + 1;
    }
  }

  if (startIdx >= endIdx) {
    return "";
  }

  return lines.slice(startIdx, endIdx).join("\n");
}

export function normalizeMatchText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

export function textContainsPresent(text: string, textContains: string[]): boolean {
  return textContains.some((marker) => marker.length > 0 && text.includes(marker));
}

export function textNotContainsViolated(text: string, textNotContains: string[]): boolean {
  const normalized = normalizeMatchText(text);
  return textNotContains.some(
    (marker) => marker.length > 0 && normalized.includes(normalizeMatchText(marker))
  );
}

export function statementTextEligible(
  text: string,
  textContains: string[],
  textNotContains: string[],
  isManual: boolean
): boolean {
  if (!isManual && textNotContainsViolated(text, textNotContains)) {
    return false;
  }
  if (
    textContains.some((marker) => marker.length > 0) &&
    !textContainsPresent(text, textContains)
  ) {
    return false;
  }
  return true;
}

export function purgeDropSections(text: string, dropSections: string[]): string {
  if (dropSections.length === 0) {
    return text;
  }

  let result = text;
  for (const marker of dropSections) {
    if (!marker) {
      continue;
    }
    result = result.replaceAll(marker, "");
  }

  return result
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .join("\n");
}
