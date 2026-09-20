import { formatIntegerAsRupee, parseRupeeToInteger } from "@web/utils/money";

export type RuleExpression =
  | { op: "and"; items: RuleExpression[] }
  | { op: "or"; items: RuleExpression[] }
  | { type: string; [key: string]: unknown };

export type RuleTextCatalogs = {
  accounts: { id: string; label: string }[];
  categories: { id: string; name: string; parentId: string | null }[];
  tags: { id: string; name: string }[];
};

type Word = { kind: "word"; value: string; line: number };
type StrTok = { kind: "string"; value: string; line: number };
type NumTok = { kind: "number"; value: string; line: number };
type OpTok = { kind: "op"; value: ">" | "<" | ">=" | "<="; line: number };
type Tok = Word | StrTok | NumTok | OpTok | { kind: "lparen" | "rparen" | "eof"; line: number };

const ACCOUNT_TYPES = [
  "bank",
  "credit_card",
  "loan",
  "stocks",
  "bonds",
  "mutual_funds",
  "unknown",
  "revenue",
  "expense",
  "tumbler",
] as const;

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

const MAX_LEAVES = 20;
const MAX_DEPTH = 4;

class RuleTextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuleTextError";
  }
}

function fail(line: number, message: string): never {
  throw new RuleTextError(`Line ${line}: ${message}`);
}

type Scan = { text: string; i: number; line: number; tokens: Tok[] };

function skipWhitespace(scan: Scan): boolean {
  const ch = scan.text[scan.i] ?? "";
  if (ch === "\n") {
    scan.line += 1;
    scan.i += 1;
    return true;
  }
  if (ch === " " || ch === "\t" || ch === "\r") {
    scan.i += 1;
    return true;
  }
  return false;
}

function scanParen(scan: Scan): boolean {
  const ch = scan.text[scan.i] ?? "";
  if (ch !== "(" && ch !== ")") {
    return false;
  }
  scan.tokens.push({ kind: ch === "(" ? "lparen" : "rparen", line: scan.line });
  scan.i += 1;
  return true;
}

function scanCompare(scan: Scan): boolean {
  const ch = scan.text[scan.i] ?? "";
  if (ch !== ">" && ch !== "<") {
    return false;
  }
  if (scan.text[scan.i + 1] === "=") {
    scan.tokens.push({ kind: "op", value: `${ch}=` as ">=" | "<=", line: scan.line });
    scan.i += 2;
    return true;
  }
  scan.tokens.push({ kind: "op", value: ch, line: scan.line });
  scan.i += 1;
  return true;
}

function appendEscape(scan: Scan, value: string): string {
  const escaped = scan.text[scan.i + 1];
  if (escaped === "\\" || escaped === '"') {
    scan.i += 2;
    return value + escaped;
  }
  fail(scan.line, "Invalid escape in string.");
}

function scanString(scan: Scan): boolean {
  if ((scan.text[scan.i] ?? "") !== '"') {
    return false;
  }
  scan.i += 1;
  let value = "";
  const start = scan.line;
  while (scan.i < scan.text.length) {
    const c = scan.text[scan.i] ?? "";
    if (c === "\n") {
      scan.line += 1;
    }
    if (c === "\\") {
      value = appendEscape(scan, value);
      continue;
    }
    if (c === '"') {
      scan.i += 1;
      scan.tokens.push({ kind: "string", value, line: start });
      return true;
    }
    value += c;
    scan.i += 1;
  }
  fail(start, "Unclosed string.");
}

function scanDecimal(scan: Scan, value: string): string {
  if (scan.text[scan.i] !== "." || !/[0-9]/.test(scan.text[scan.i + 1] ?? "")) {
    return value;
  }
  let next = `${value}.`;
  scan.i += 1;
  while (scan.i < scan.text.length && /[0-9]/.test(scan.text[scan.i] ?? "")) {
    next += scan.text[scan.i];
    scan.i += 1;
  }
  return next;
}

function scanNumber(scan: Scan): boolean {
  const ch = scan.text[scan.i] ?? "";
  if (!/[0-9]/.test(ch)) {
    return false;
  }
  const dateMatch = /^\d{4}-\d{2}-\d{2}/.exec(scan.text.slice(scan.i));
  if (dateMatch) {
    scan.tokens.push({ kind: "word", value: dateMatch[0], line: scan.line });
    scan.i += dateMatch[0].length;
    return true;
  }
  let value = ch;
  scan.i += 1;
  while (scan.i < scan.text.length && /[0-9]/.test(scan.text[scan.i] ?? "")) {
    value += scan.text[scan.i];
    scan.i += 1;
  }
  value = scanDecimal(scan, value);
  scan.tokens.push({ kind: "number", value, line: scan.line });
  return true;
}

function scanWord(scan: Scan): boolean {
  const ch = scan.text[scan.i] ?? "";
  if (!/[A-Za-z_]/.test(ch)) {
    return false;
  }
  let value = ch;
  scan.i += 1;
  while (scan.i < scan.text.length && /[A-Za-z0-9_-]/.test(scan.text[scan.i] ?? "")) {
    value += scan.text[scan.i];
    scan.i += 1;
  }
  scan.tokens.push({ kind: "word", value, line: scan.line });
  return true;
}

function tokenize(text: string): Tok[] {
  const scan: Scan = { text, i: 0, line: 1, tokens: [] };
  while (scan.i < text.length) {
    if (skipWhitespace(scan) || scanParen(scan) || scanCompare(scan)) {
      continue;
    }
    if (scanString(scan) || scanNumber(scan) || scanWord(scan)) {
      continue;
    }
    fail(scan.line, `Unexpected character ${scan.text[scan.i] ?? ""}.`);
  }
  scan.tokens.push({ kind: "eof", line: scan.line });
  return scan.tokens;
}

function quote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function rupees(raw: string, line: number): number {
  let minor: number;
  try {
    minor = parseRupeeToInteger(raw);
  } catch {
    fail(line, "Amount must be greater than 0.");
  }
  if (!Number.isInteger(minor) || minor <= 0) {
    fail(line, "Amount must be greater than 0.");
  }
  return minor;
}

function formatAmount(minor: number): string {
  const text = formatIntegerAsRupee(minor);
  return text.endsWith(".00") ? text.slice(0, -3) : text;
}

function sameName(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function uniqueId(
  rows: { id: string; name: string }[],
  name: string,
  kind: "account" | "category" | "tag",
  line: number
): string {
  const matches = rows.filter((row) => sameName(row.name, name));
  if (matches.length === 0) {
    const label = kind === "account" ? "account" : kind === "category" ? "category" : "tag";
    fail(line, `Unknown ${label} "${name}".`);
  }
  if (matches.length > 1) {
    fail(line, `More than one ${kind} is named "${name}".`);
  }
  return matches[0]?.id ?? "";
}

function nameById(rows: { id: string; name: string }[], id: string): string {
  return rows.find((row) => row.id === id)?.name ?? id;
}

function namedAccountLeaf(side: "source" | "destination" | "either", negated: boolean): string {
  if (side === "source") {
    return negated ? "source_account_is_not" : "source_account_is";
  }
  if (side === "destination") {
    return negated ? "destination_account_is_not" : "destination_account_is";
  }
  return negated ? "either_account_is_not" : "either_account_is";
}

function accountTypeLeaf(side: "source" | "destination" | "either"): string {
  if (side === "source") {
    return "source_account_type_is";
  }
  if (side === "destination") {
    return "destination_account_type_is";
  }
  return "either_account_type_is";
}

class Parser {
  private index = 0;
  private leaves = 0;
  private depth = 0;

  constructor(
    private readonly tokens: Tok[],
    private readonly catalogs: RuleTextCatalogs
  ) {}

  parse(): RuleExpression {
    if (this.peek().kind === "eof") {
      throw new RuleTextError("Write at least one condition.");
    }
    const expr = this.parseOr();
    if (this.peek().kind !== "eof") {
      const tok = this.peek();
      fail(tok.line, "Unexpected text after the conditions.");
    }
    return expr;
  }

  private peek(): Tok {
    return this.tokens[this.index] ?? { kind: "eof", line: 1 };
  }

  private take(): Tok {
    const tok = this.peek();
    if (tok.kind !== "eof") {
      this.index += 1;
    }
    return tok;
  }

  private wordIs(value: string): boolean {
    const tok = this.peek();
    return tok.kind === "word" && tok.value.toLowerCase() === value;
  }

  private takeWord(expected?: string): Word {
    const tok = this.peek();
    if (tok.kind !== "word") {
      fail(tok.line, "Expected a word.");
    }
    if (expected && tok.value.toLowerCase() !== expected) {
      fail(tok.line, `Expected ${expected}.`);
    }
    this.take();
    return tok;
  }

  private takeString(): string {
    const tok = this.peek();
    if (tok.kind !== "string") {
      fail(tok.line, "Expected a quoted value.");
    }
    this.take();
    return tok.value;
  }

  private takeNumber(): { raw: string; line: number } {
    const tok = this.peek();
    if (tok.kind !== "number") {
      fail(tok.line, "Expected a number.");
    }
    this.take();
    return { raw: tok.value, line: tok.line };
  }

  private takeDate(): string {
    const tok = this.takeWord();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tok.value)) {
      fail(tok.line, "Expected a date as YYYY-MM-DD.");
    }
    return tok.value;
  }

  private leaf(type: string, extra?: Record<string, unknown>): RuleExpression {
    this.leaves += 1;
    if (this.leaves > MAX_LEAVES) {
      throw new RuleTextError("This rule has more than 20 conditions.");
    }
    return extra ? { type, ...extra } : { type };
  }

  private parseOr(): RuleExpression {
    const items = [this.parseAnd()];
    while (this.wordIs("or")) {
      this.take();
      items.push(this.parseAnd());
    }
    return items.length === 1 ? (items[0] as RuleExpression) : { op: "or", items };
  }

  private parseAnd(): RuleExpression {
    const items = [this.parsePrimary()];
    while (this.wordIs("and")) {
      this.take();
      items.push(this.parsePrimary());
    }
    return items.length === 1 ? (items[0] as RuleExpression) : { op: "and", items };
  }

  private parsePrimary(): RuleExpression {
    if (this.peek().kind === "lparen") {
      const open = this.take();
      this.depth += 1;
      if (this.depth > MAX_DEPTH) {
        fail(open.line, "Groups can only nest 4 levels deep.");
      }
      if (this.peek().kind === "rparen") {
        fail(open.line, "A group needs at least one condition.");
      }
      const inner = this.parseOr();
      if (this.peek().kind !== "rparen") {
        fail(this.peek().line, "Expected ).");
      }
      this.take();
      this.depth -= 1;
      return inner;
    }
    return this.parseCondition();
  }

  private parseCondition(): RuleExpression {
    const first = this.peek();
    if (first.kind !== "word") {
      fail(first.line, "Expected a condition.");
    }
    const head = first.value.toLowerCase();
    return (
      this.parseValueCondition(head) ??
      this.parseWhenCondition(head) ??
      this.parsePartyCondition(head, first.line) ??
      fail(first.line, "Unknown condition.")
    );
  }

  private parseValueCondition(head: string): RuleExpression | null {
    if (head === "description" || head === "reference") {
      this.take();
      return this.parseTextField(head === "description" ? "description" : "reference");
    }
    if (head === "amount") {
      this.take();
      return this.parseAmount();
    }
    if (head === "date") {
      this.take();
      return this.parseDate();
    }
    return null;
  }

  private parseWhenCondition(head: string): RuleExpression | null {
    if (head === "weekday") {
      return this.parseNamedIndex(
        "date_weekday_is",
        "weekday",
        WEEKDAYS,
        "Expected a weekday name."
      );
    }
    if (head === "month") {
      return this.parseNamedIndex("date_month_is", "month", MONTHS, "Expected a month name.");
    }
    return null;
  }

  private parseNamedIndex(
    type: string,
    field: "weekday" | "month",
    names: readonly string[],
    message: string
  ): RuleExpression {
    this.take();
    this.takeWord("is");
    const name = this.takeWord();
    const index = names.indexOf(name.value.toLowerCase());
    if (index < 0) {
      fail(name.line, message);
    }
    return this.leaf(type, { [field]: index + 1 });
  }

  private parsePartyCondition(head: string, line: number): RuleExpression | null {
    if (head === "source" || head === "destination" || head === "either") {
      return this.parseAccountSide(head);
    }
    if (head === "transaction") {
      return this.parseTransactionKind();
    }
    if (head === "category") {
      return this.parseCategory();
    }
    if (head === "tag") {
      return this.parseTag(line);
    }
    if (head === "has") {
      return this.parseHas();
    }
    if (head === "import") {
      return this.parseImport(line);
    }
    return null;
  }

  private parseTransactionKind(): RuleExpression {
    this.take();
    this.takeWord("is");
    const kind = this.takeWord();
    const map: Record<string, string> = {
      spend: "pair_is_spend",
      income: "pair_is_income",
      transfer: "pair_is_transfer",
    };
    const type = map[kind.value.toLowerCase()];
    if (!type) {
      fail(kind.line, "Expected spend, income, or transfer.");
    }
    return this.leaf(type);
  }

  private parseTag(line: number): RuleExpression {
    this.take();
    if (this.wordIs("is") && this.lookaheadIsNot()) {
      this.takeWord("is");
      this.takeWord("not");
      return this.leaf("tag_is_not", { tagId: this.resolveTag(this.takeString(), line) });
    }
    this.takeWord("is");
    return this.leaf("tag_is", { tagId: this.resolveTag(this.takeString(), line) });
  }

  private parseHas(): RuleExpression {
    this.take();
    if (this.wordIs("no")) {
      return this.parseHasNo();
    }
    if (this.wordIs("any")) {
      this.take();
      this.takeWord("tag");
      return this.leaf("has_any_tag");
    }
    if (this.wordIs("import")) {
      this.take();
      return this.leaf("has_import");
    }
    fail(this.peek().line, "Expected no tags, any tag, import, or no import.");
  }

  private parseHasNo(): RuleExpression {
    this.take();
    if (this.wordIs("tags")) {
      this.take();
      return this.leaf("has_no_tags");
    }
    if (this.wordIs("import")) {
      this.take();
      return this.leaf("has_no_import");
    }
    fail(this.peek().line, "Expected tags or import.");
  }

  private parseImport(line: number): RuleExpression {
    this.take();
    this.takeWord("is");
    const id = this.takeString();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      fail(line, "Expected an import id.");
    }
    return this.leaf("import_id_is", { importId: id });
  }

  private lookaheadIsNot(): boolean {
    const first = this.tokens[this.index];
    const second = this.tokens[this.index + 1];
    return (
      first?.kind === "word" &&
      first.value.toLowerCase() === "is" &&
      second?.kind === "word" &&
      second.value.toLowerCase() === "not"
    );
  }

  private parseTextField(field: "description" | "reference"): RuleExpression {
    const prefix = field === "description" ? "description" : "ref";
    if (this.wordIs("contains")) {
      this.take();
      return this.leaf(`${prefix}_contains`, { value: this.takeString() });
    }
    if (this.wordIs("does")) {
      this.take();
      this.takeWord("not");
      this.takeWord("contain");
      return this.leaf(`${prefix}_not_contains`, { value: this.takeString() });
    }
    if (this.wordIs("starts")) {
      this.take();
      this.takeWord("with");
      return this.leaf(`${prefix}_starts`, { value: this.takeString() });
    }
    if (this.wordIs("ends")) {
      this.take();
      this.takeWord("with");
      return this.leaf(`${prefix}_ends`, { value: this.takeString() });
    }
    if (this.wordIs("matches")) {
      this.take();
      return this.leaf(`${prefix}_matches_regex`, { value: this.takeString() });
    }
    if (this.wordIs("is")) {
      this.take();
      if (field === "reference" && this.wordIs("empty")) {
        this.take();
        return this.leaf("ref_is_empty");
      }
      if (field === "reference" && this.wordIs("set")) {
        this.take();
        return this.leaf("ref_is_set");
      }
      if (this.wordIs("not")) {
        this.take();
        return this.leaf(`${prefix}_is_not`, { value: this.takeString() });
      }
      return this.leaf(`${prefix}_is`, { value: this.takeString() });
    }
    fail(this.peek().line, "Expected a comparison.");
  }

  private parseAmount(): RuleExpression {
    if (this.wordIs("is")) {
      this.take();
      if (this.wordIs("not")) {
        this.take();
        const num = this.takeNumber();
        return this.leaf("amount_not", { amount: rupees(num.raw, num.line) });
      }
      const num = this.takeNumber();
      return this.leaf("amount_exactly", { amount: rupees(num.raw, num.line) });
    }
    if (this.wordIs("between")) {
      this.take();
      const min = this.takeNumber();
      this.takeWord("and");
      const max = this.takeNumber();
      const minMinor = rupees(min.raw, min.line);
      const maxMinor = rupees(max.raw, max.line);
      if (minMinor > maxMinor) {
        fail(min.line, "Minimum is greater than maximum.");
      }
      return this.leaf("amount_between", { min: minMinor, max: maxMinor });
    }
    const op = this.peek();
    if (op.kind !== "op") {
      fail(op.line, "Expected an amount comparison.");
    }
    this.take();
    const num = this.takeNumber();
    const amount = rupees(num.raw, num.line);
    const type =
      op.value === "<"
        ? "amount_less"
        : op.value === "<="
          ? "amount_less_or_equal"
          : op.value === ">"
            ? "amount_greater"
            : "amount_greater_or_equal";
    return this.leaf(type, { amount });
  }

  private parseDate(): RuleExpression {
    if (this.wordIs("between")) {
      this.take();
      const from = this.takeDate();
      this.takeWord("and");
      const to = this.takeDate();
      if (from > to) {
        fail(this.peek().line, "Minimum is greater than maximum.");
      }
      return this.leaf("date_between", { from, to });
    }
    if (this.wordIs("is")) {
      this.take();
      if (this.wordIs("not")) {
        this.take();
        return this.leaf("date_is_not", { date: this.takeDate() });
      }
      return this.leaf("date_is", { date: this.takeDate() });
    }
    if (this.wordIs("before")) {
      this.take();
      return this.leaf("date_before", { date: this.takeDate() });
    }
    if (this.wordIs("after")) {
      this.take();
      return this.leaf("date_after", { date: this.takeDate() });
    }
    if (this.wordIs("on")) {
      this.take();
      this.takeWord("or");
      if (this.wordIs("before")) {
        this.take();
        return this.leaf("date_on_or_before", { date: this.takeDate() });
      }
      this.takeWord("after");
      return this.leaf("date_on_or_after", { date: this.takeDate() });
    }
    fail(this.peek().line, "Expected a date comparison.");
  }

  private parseAccountSide(side: "source" | "destination" | "either"): RuleExpression {
    const start = this.take();
    if (this.wordIs("account")) {
      return this.parseNamedAccount(side, start.line);
    }
    if (this.wordIs("type")) {
      return this.parseAccountType(side);
    }
    if (side !== "either" && this.wordIs("is")) {
      return this.parseSystemOrInstrument(side);
    }
    fail(start.line, "Expected an account condition.");
  }

  private parseNamedAccount(
    side: "source" | "destination" | "either",
    line: number
  ): RuleExpression {
    this.take();
    const negated = this.lookaheadIsNot();
    this.takeWord("is");
    if (negated) {
      this.takeWord("not");
    }
    const name = this.takeString();
    const accountId = uniqueId(
      this.catalogs.accounts.map((row) => ({ id: row.id, name: row.label })),
      name,
      "account",
      line
    );
    return this.leaf(namedAccountLeaf(side, negated), { accountId });
  }

  private parseAccountType(side: "source" | "destination" | "either"): RuleExpression {
    this.take();
    this.takeWord("is");
    const name = this.takeWord();
    const accountType = name.value.toLowerCase();
    if (!(ACCOUNT_TYPES as readonly string[]).includes(accountType)) {
      fail(name.line, "Unknown account type.");
    }
    return this.leaf(accountTypeLeaf(side), { accountType });
  }

  private parseSystemOrInstrument(side: "source" | "destination"): RuleExpression {
    this.take();
    if (this.wordIs("system")) {
      this.take();
      return this.leaf(side === "source" ? "source_is_system" : "destination_is_system");
    }
    this.takeWord("instrument");
    return this.leaf(side === "source" ? "source_is_instrument" : "destination_is_instrument");
  }

  private parseCategory(): RuleExpression {
    const start = this.take();
    this.takeWord("is");
    if (this.wordIs("empty")) {
      this.take();
      return this.leaf("has_no_category");
    }
    if (this.wordIs("set")) {
      this.take();
      return this.leaf("has_category");
    }
    const negated = this.wordIs("not");
    if (negated) {
      this.take();
    }
    const name = this.takeString();
    const slash = name.indexOf(" / ");
    if (slash === -1) {
      const roots = this.catalogs.categories.filter((row) => row.parentId === null);
      const categoryId = uniqueId(roots, name, "category", start.line);
      return this.leaf(negated ? "category_is_not" : "category_is", { categoryId });
    }
    const parentName = name.slice(0, slash);
    const childName = name.slice(slash + 3);
    const parentId = uniqueId(
      this.catalogs.categories.filter((row) => row.parentId === null),
      parentName,
      "category",
      start.line
    );
    const subcategoryId = uniqueId(
      this.catalogs.categories.filter((row) => row.parentId === parentId),
      childName,
      "category",
      start.line
    );
    return this.leaf(negated ? "subcategory_is_not" : "subcategory_is", { subcategoryId });
  }

  private resolveTag(name: string, line: number): string {
    return uniqueId(this.catalogs.tags, name, "tag", line);
  }
}

export function parseRuleText(
  text: string,
  catalogs: RuleTextCatalogs
): { ok: true; when: RuleExpression } | { ok: false; error: string } {
  try {
    const when = new Parser(tokenize(text), catalogs).parse();
    return { ok: true, when };
  } catch (error: unknown) {
    if (error instanceof RuleTextError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "Could not read conditions." };
  }
}

function stringField(expr: RuleExpression): string {
  return typeof expr === "object" && "value" in expr && typeof expr.value === "string"
    ? expr.value
    : "";
}

const TEXT_LEAF_VERBS: Record<string, string> = {
  description_contains: "description contains",
  description_not_contains: "description does not contain",
  description_is: "description is",
  description_is_not: "description is not",
  description_starts: "description starts with",
  description_ends: "description ends with",
  description_matches_regex: "description matches",
  ref_contains: "reference contains",
  ref_not_contains: "reference does not contain",
  ref_is: "reference is",
  ref_is_not: "reference is not",
  ref_starts: "reference starts with",
  ref_ends: "reference ends with",
  ref_matches_regex: "reference matches",
};

const AMOUNT_LEAF_VERBS: Record<string, string> = {
  amount_exactly: "amount is",
  amount_not: "amount is not",
  amount_less: "amount <",
  amount_less_or_equal: "amount <=",
  amount_greater: "amount >",
  amount_greater_or_equal: "amount >=",
};

const DATE_LEAF_VERBS: Record<string, string> = {
  date_is: "date is",
  date_is_not: "date is not",
  date_before: "date before",
  date_after: "date after",
  date_on_or_before: "date on or before",
  date_on_or_after: "date on or after",
};

const ACCOUNT_NAME_VERBS: Record<string, string> = {
  source_account_is: "source account is",
  source_account_is_not: "source account is not",
  destination_account_is: "destination account is",
  destination_account_is_not: "destination account is not",
  either_account_is: "either account is",
  either_account_is_not: "either account is not",
};

const ACCOUNT_TYPE_VERBS: Record<string, string> = {
  source_account_type_is: "source type is",
  destination_account_type_is: "destination type is",
  either_account_type_is: "either type is",
};

const FIXED_LEAF_TEXT: Record<string, string> = {
  ref_is_empty: "reference is empty",
  ref_is_set: "reference is set",
  source_is_system: "source is system",
  destination_is_system: "destination is system",
  source_is_instrument: "source is instrument",
  destination_is_instrument: "destination is instrument",
  pair_is_spend: "transaction is spend",
  pair_is_income: "transaction is income",
  pair_is_transfer: "transaction is transfer",
  has_category: "category is set",
  has_no_category: "category is empty",
  has_no_tags: "has no tags",
  has_any_tag: "has any tag",
  has_import: "has import",
  has_no_import: "has no import",
};

type RuleLeaf = { type: string; [key: string]: unknown };

function isRuleLeaf(expr: RuleExpression): expr is RuleLeaf {
  return "type" in expr && typeof expr.type === "string" && !isRuleGroup(expr);
}

function formatLeaf(expr: RuleExpression, catalogs: RuleTextCatalogs): string {
  if (!isRuleLeaf(expr)) {
    return "";
  }
  return formatKnownLeaf(expr.type, expr, catalogs) ?? expr.type;
}

function formatKnownLeaf(type: string, expr: RuleLeaf, catalogs: RuleTextCatalogs): string | null {
  const fixed = FIXED_LEAF_TEXT[type];
  if (fixed) {
    return fixed;
  }
  const textVerb = TEXT_LEAF_VERBS[type];
  if (textVerb) {
    return `${textVerb} ${quote(stringField(expr))}`;
  }
  const amount = formatAmountLeaf(type, expr);
  if (amount) {
    return amount;
  }
  const date = formatDateLeaf(type, expr);
  if (date) {
    return date;
  }
  const account = formatAccountLeaf(type, expr, catalogs);
  if (account) {
    return account;
  }
  return formatTaxonomyLeaf(type, expr, catalogs);
}

function formatAmountLeaf(type: string, expr: RuleLeaf): string | null {
  if (type === "amount_between") {
    const min = typeof expr.min === "number" ? formatAmount(expr.min) : "0";
    const max = typeof expr.max === "number" ? formatAmount(expr.max) : "0";
    return `amount between ${min} and ${max}`;
  }
  const verb = AMOUNT_LEAF_VERBS[type];
  if (!verb) {
    return null;
  }
  const amount = typeof expr.amount === "number" ? formatAmount(expr.amount) : "0";
  return `${verb} ${amount}`;
}

function formatDateLeaf(type: string, expr: RuleLeaf): string | null {
  if (type === "date_between") {
    return `date between ${String(expr.from ?? "")} and ${String(expr.to ?? "")}`;
  }
  if (type === "date_weekday_is") {
    const weekday = typeof expr.weekday === "number" ? WEEKDAYS[expr.weekday - 1] : "monday";
    return `weekday is ${weekday ?? "monday"}`;
  }
  if (type === "date_month_is") {
    const month = typeof expr.month === "number" ? MONTHS[expr.month - 1] : "january";
    return `month is ${month ?? "january"}`;
  }
  const verb = DATE_LEAF_VERBS[type];
  if (!verb) {
    return null;
  }
  const date = typeof expr.date === "string" ? expr.date : "";
  return `${verb} ${date}`;
}

function formatAccountLeaf(
  type: string,
  expr: RuleLeaf,
  catalogs: RuleTextCatalogs
): string | null {
  const nameVerb = ACCOUNT_NAME_VERBS[type];
  if (nameVerb) {
    const label = nameById(
      catalogs.accounts.map((row) => ({ id: row.id, name: row.label })),
      String(expr.accountId ?? "")
    );
    return `${nameVerb} ${quote(label)}`;
  }
  const typeVerb = ACCOUNT_TYPE_VERBS[type];
  if (!typeVerb) {
    return null;
  }
  return `${typeVerb} ${String(expr.accountType ?? "")}`;
}

function formatTaxonomyLeaf(
  type: string,
  expr: RuleLeaf,
  catalogs: RuleTextCatalogs
): string | null {
  if (type === "category_is" || type === "category_is_not") {
    const name = quote(nameById(catalogs.categories, String(expr.categoryId ?? "")));
    return type === "category_is" ? `category is ${name}` : `category is not ${name}`;
  }
  if (type === "subcategory_is" || type === "subcategory_is_not") {
    return formatSubcategoryLeaf(type, expr, catalogs);
  }
  if (type === "tag_is" || type === "tag_is_not") {
    const name = quote(nameById(catalogs.tags, String(expr.tagId ?? "")));
    return type === "tag_is" ? `tag is ${name}` : `tag is not ${name}`;
  }
  if (type === "import_id_is") {
    return `import is ${quote(String(expr.importId ?? ""))}`;
  }
  return null;
}

function formatSubcategoryLeaf(type: string, expr: RuleLeaf, catalogs: RuleTextCatalogs): string {
  const child = catalogs.categories.find((row) => row.id === expr.subcategoryId);
  const parent = catalogs.categories.find((row) => row.id === child?.parentId);
  const label =
    child && parent ? `${parent.name} / ${child.name}` : String(expr.subcategoryId ?? "");
  const quoted = quote(label);
  return type === "subcategory_is" ? `category is ${quoted}` : `category is not ${quoted}`;
}

function indent(text: string): string {
  return text
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}

function isRuleGroup(expr: RuleExpression): expr is { op: "and" | "or"; items: RuleExpression[] } {
  if (!("op" in expr) || !("items" in expr) || !Array.isArray(expr.items)) {
    return false;
  }
  return expr.op === "and" || expr.op === "or";
}

function formatNode(
  expr: RuleExpression,
  catalogs: RuleTextCatalogs
): { text: string; op: "and" | "or" | null; multi: boolean } {
  if (!isRuleGroup(expr)) {
    return { text: formatLeaf(expr, catalogs), op: null, multi: false };
  }
  const [only] = expr.items;
  if (expr.items.length === 1 && only) {
    return formatNode(only, catalogs);
  }
  const parts = expr.items.map((item) => {
    const child = formatNode(item, catalogs);
    if (child.multi && child.op !== expr.op) {
      return { text: `(\n${indent(child.text)}\n)` };
    }
    return { text: child.text };
  });
  return {
    text: parts.map((part) => part.text).join(`\n${expr.op} `),
    op: expr.op,
    multi: true,
  };
}

export function formatRuleWhen(when: RuleExpression, catalogs: RuleTextCatalogs): string {
  return formatNode(when, catalogs).text;
}
