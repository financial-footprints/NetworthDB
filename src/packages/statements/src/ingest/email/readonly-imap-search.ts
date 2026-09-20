/** Convert string IMAP criteria to imapflow search objects. */
import { parse } from "date-fns";
import type { SearchObject } from "imapflow";

function parseImapDate(value: string): Date {
  return parse(value, "dd-MMM-yyyy", new Date());
}

function applySince(query: SearchObject, criteria: string[], index: number): number {
  const date = criteria[index + 1];
  if (date) {
    query.since = parseImapDate(date);
    return index + 1;
  }
  return index;
}

function applyBefore(query: SearchObject, criteria: string[], index: number): number {
  const date = criteria[index + 1];
  if (date) {
    query.before = parseImapDate(date);
    return index + 1;
  }
  return index;
}

function applySubject(orSubjects: string[], criteria: string[], index: number): number {
  const subject = criteria[index + 1];
  if (subject) {
    orSubjects.push(subject);
    return index + 1;
  }
  return index;
}

function finalizeSubjectQuery(query: SearchObject, orSubjects: string[]): void {
  if (orSubjects.length === 1) {
    query.subject = orSubjects[0];
  } else if (orSubjects.length > 1) {
    query.or = orSubjects.map((subject) => ({ subject }));
  }
}

export function prepareSearchCriteriaFromStrings(criteria: string[]): SearchObject {
  const query: SearchObject = {};
  const orSubjects: string[] = [];

  for (let index = 0; index < criteria.length; index += 1) {
    const token = criteria[index] ?? "";
    const upper = token.toUpperCase();

    if (upper === "SINCE") {
      index = applySince(query, criteria, index);
      continue;
    }
    if (upper === "BEFORE") {
      index = applyBefore(query, criteria, index);
      continue;
    }
    if (upper === "SUBJECT") {
      index = applySubject(orSubjects, criteria, index);
      continue;
    }
    if (upper === "OR") {
    }
  }

  finalizeSubjectQuery(query, orSubjects);
  return query;
}

export type { ImapSearchPlan } from "@statements/ingest/email/imap-search";
