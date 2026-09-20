const FORBIDDEN_PATTERN =
  /\b(INSERT|UPDATE|DELETE|COPY|TRUNCATE|CREATE|ALTER|DROP|GRANT|REVOKE)\b/i;
const SELECT_INTO_PATTERN = /\bSELECT\b[\s\S]*\bINTO\b/i;
const FOR_UPDATE_PATTERN = /\bFOR\s+UPDATE\b/i;

function findNextCommentIndex(sql: string, index: number): number {
  const lineComment = sql.indexOf("--", index);
  const blockComment = sql.indexOf("/*", index);
  if (lineComment === -1 && blockComment === -1) {
    return -1;
  }
  if (lineComment === -1) {
    return blockComment;
  }
  if (blockComment === -1) {
    return lineComment;
  }
  return Math.min(lineComment, blockComment);
}

function consumeLineComment(sql: string, start: number): number {
  const lineEnd = sql.indexOf("\n", start);
  return lineEnd === -1 ? sql.length : lineEnd;
}

function consumeBlockComment(sql: string, start: number): number {
  const blockEnd = sql.indexOf("*/", start + 2);
  if (blockEnd === -1) {
    throw new Error("database.readonly.guard.unclosed-block-comment");
  }
  return blockEnd + 2;
}

function stripComments(sql: string): string {
  let result = "";
  let index = 0;

  while (index < sql.length) {
    const next = findNextCommentIndex(sql, index);
    if (next === -1) {
      result += sql.slice(index);
      break;
    }

    result += sql.slice(index, next);
    const lineAt = sql.indexOf("--", index);
    if (lineAt === next) {
      index = consumeLineComment(sql, next);
    } else {
      index = consumeBlockComment(sql, next);
    }
    result += " ";
  }

  return result.trim();
}

function normalizeStatement(sql: string): string {
  const withoutComments = stripComments(sql);
  const trimmed = withoutComments.trim().replace(/;+\s*$/, "");
  if (trimmed.includes(";")) {
    throw new Error("database.readonly.guard.multiple-statements");
  }
  return trimmed;
}

function assertAllowedStatement(sql: string): void {
  const normalized = normalizeStatement(sql);
  if (normalized.length === 0) {
    throw new Error("database.readonly.guard.empty-sql");
  }

  const startsAllowed = /^(SELECT|WITH|EXPLAIN)\b/i.test(normalized);
  if (!startsAllowed) {
    throw new Error("database.readonly.guard.statement-not-read-only");
  }

  if (FOR_UPDATE_PATTERN.test(normalized)) {
    throw new Error("database.readonly.guard.for-update-not-allowed");
  }

  if (FORBIDDEN_PATTERN.test(normalized)) {
    throw new Error("database.readonly.guard.statement-not-read-only");
  }

  if (SELECT_INTO_PATTERN.test(normalized)) {
    throw new Error("database.readonly.guard.statement-not-read-only");
  }
}

export function guardReadonlySql(sql: string): string {
  assertAllowedStatement(sql);
  return normalizeStatement(sql);
}
