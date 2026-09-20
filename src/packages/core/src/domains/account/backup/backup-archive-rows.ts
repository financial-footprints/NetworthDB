import { JobExecutionError } from "@core/domains/jobs/embedded/output";
import type { SourceWriteInput } from "@core/domains/sources/entities/sources";

export type BackupTransactionRow = {
  id: string;
  date: string;
  amount: number;
  source_account_id: string;
  destination_account_id: string;
  description: string;
  ref_no: string | null;
  import_id: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  tag_ids: string[];
  created_at: string;
  updated_at: string;
};

function readNullableStringField(entry: Record<string, unknown>, key: string): string | null {
  const value = entry[key];
  if (value === null || typeof value === "string") {
    return value;
  }
  return null;
}

function parseThunderbirdSourceRow(entry: Record<string, unknown>, id: string): SourceWriteInput {
  return {
    id,
    type: "thunderbird",
    label: typeof entry.label === "string" ? entry.label : undefined,
    profile: typeof entry.profile === "string" ? entry.profile : "",
  };
}

function parseEmailSourceRow(entry: Record<string, unknown>, id: string): SourceWriteInput {
  const write: SourceWriteInput = {
    id,
    type: "email",
    label: typeof entry.label === "string" ? entry.label : undefined,
    host: typeof entry.host === "string" ? entry.host : "",
    port: typeof entry.port === "number" ? entry.port : undefined,
    username: typeof entry.username === "string" ? entry.username : "",
    folder: typeof entry.folder === "string" ? entry.folder : undefined,
    useSsl: typeof entry.use_ssl === "boolean" ? entry.use_ssl : undefined,
  };
  if ("password" in entry && typeof entry.password === "string") {
    (write as { password?: string }).password = entry.password;
  }
  return write;
}

export function parseSourceRow(raw: unknown): SourceWriteInput {
  if (typeof raw !== "object" || raw === null) {
    throw new JobExecutionError("Sources file has an invalid entry.");
  }
  const entry = raw as Record<string, unknown>;
  const type = entry.type;
  const id = typeof entry.id === "string" ? entry.id : "";
  if (!id || (type !== "thunderbird" && type !== "email")) {
    throw new JobExecutionError("Sources file has an invalid entry.");
  }
  if (type === "thunderbird") {
    return parseThunderbirdSourceRow(entry, id);
  }
  return parseEmailSourceRow(entry, id);
}

export function parseSourcesWrite(raw: string | undefined): SourceWriteInput[] {
  if (!raw) {
    return [];
  }
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new JobExecutionError("Sources file is invalid.");
  }
  return parsed.map((row) => parseSourceRow(row));
}

export function parseTransactionRow(raw: unknown): BackupTransactionRow {
  if (typeof raw !== "object" || raw === null) {
    throw new JobExecutionError("Transactions file has an invalid entry.");
  }
  const entry = raw as Record<string, unknown>;
  const id = typeof entry.id === "string" ? entry.id : "";
  const date = typeof entry.date === "string" ? entry.date : "";
  const amount = typeof entry.amount === "number" ? entry.amount : Number.NaN;
  const sourceAccountId =
    typeof entry.source_account_id === "string" ? entry.source_account_id : "";
  const destinationAccountId =
    typeof entry.destination_account_id === "string" ? entry.destination_account_id : "";
  const description = typeof entry.description === "string" ? entry.description : "";
  if (!id || !date || !Number.isFinite(amount) || !sourceAccountId || !destinationAccountId) {
    throw new JobExecutionError("Transactions file has an invalid entry.");
  }
  return {
    id,
    date,
    amount,
    source_account_id: sourceAccountId,
    destination_account_id: destinationAccountId,
    description,
    ref_no: readNullableStringField(entry, "ref_no"),
    import_id: readNullableStringField(entry, "import_id"),
    category_id: readNullableStringField(entry, "category_id"),
    subcategory_id: readNullableStringField(entry, "subcategory_id"),
    tag_ids: Array.isArray(entry.tag_ids) ? entry.tag_ids.map(String) : [],
    created_at: typeof entry.created_at === "string" ? entry.created_at : new Date().toISOString(),
    updated_at: typeof entry.updated_at === "string" ? entry.updated_at : new Date().toISOString(),
  };
}
