function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i] ?? "";
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current);
  return cells;
}

export function parseTransactionsCsv(text: string): Array<{
  date: string;
  description: string;
  ref: string;
  credited: string;
  debited: string;
}> {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length <= 1) {
    return [];
  }
  const rows: Array<{
    date: string;
    description: string;
    ref: string;
    credited: string;
    debited: string;
  }> = [];
  for (const line of lines.slice(1)) {
    const [date, description, ref, credited, debited] = parseCsvLine(line);
    if (!date || !description) {
      continue;
    }
    rows.push({
      date,
      description,
      ref: ref ?? "",
      credited: credited ?? "0",
      debited: debited ?? "0",
    });
  }
  return rows;
}
