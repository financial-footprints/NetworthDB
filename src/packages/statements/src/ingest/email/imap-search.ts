import { format } from "date-fns";

export function escapeGmailTerm(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

export function gmailAfterClause(startDate: Date | null): string {
  if (!startDate) {
    return "";
  }
  return ` after:${format(startDate, "yyyy/MM/dd")}`;
}

export function gmailBeforeClause(endDate: Date | null): string {
  if (!endDate) {
    return "";
  }
  return ` before:${format(endDate, "yyyy/MM/dd")}`;
}

export function buildGmailRawQuery(
  subjects: string[],
  startDate: Date | null,
  endDate: Date | null
): string {
  const subjectTerms = subjects
    .map((subject) => `subject:"${escapeGmailTerm(subject)}"`)
    .join(" OR ");
  return `has:attachment (${subjectTerms})${gmailAfterClause(startDate)}${gmailBeforeClause(endDate)}`;
}

function imapSinceClause(startDate: Date | null): string {
  return startDate ? format(startDate, "dd-MMM-yyyy") : "";
}

function imapBeforeClause(endDate: Date | null): string {
  return endDate ? format(endDate, "dd-MMM-yyyy") : "";
}

export type ImapSearchPlan = {
  charset: "UTF-8" | null;
  criteria: string[];
  gmailRaw?: string;
};

export function buildImapSearchCriteria(
  subjects: string[],
  startDate: Date | null,
  host: string,
  endDate: Date | null
): ImapSearchPlan {
  if (host.trimEnd().replace(/\.$/, "").endsWith("gmail.com")) {
    const gmailRaw = buildGmailRawQuery(subjects, startDate, endDate);
    return {
      charset: null,
      criteria: ["X-GM-RAW", gmailRaw],
      gmailRaw,
    };
  }

  const criteria: string[] = [];
  if (startDate) {
    criteria.push("SINCE", imapSinceClause(startDate));
  }
  if (endDate) {
    criteria.push("BEFORE", imapBeforeClause(endDate));
  }

  if (subjects.length === 1) {
    criteria.push("SUBJECT", subjects[0] ?? "");
  } else if (subjects.length > 1) {
    let orParts: string[] = [];
    for (const subject of [...subjects].reverse()) {
      if (orParts.length === 0) {
        orParts = ["SUBJECT", subject];
      } else {
        orParts = ["OR", "SUBJECT", subject, ...orParts];
      }
    }
    criteria.push(...orParts);
  }

  return { charset: "UTF-8", criteria };
}
