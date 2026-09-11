import type {
  AccountType,
  AccountUpdatePayload,
  AccountWritePayload,
  BankVariant,
} from "@web/utils/api/endpoints/accounts/types";
import { isDefaultVariant } from "@web/utils/banks";
import { sealField } from "@web/utils/crypto/vault";
import { toIsoAccountDate } from "@web/utils/time";

export function emptyForm(accountType: AccountType): AccountWritePayload {
  return {
    bank: "",
    variant: null,
    account_number: "",
    passwords: [],
    opening_date: "",
    closing_date: null,
    statement: { text_contains: [], text_not_contains: [] },
    mail: { subjects: [], body_contains: [], from: [] },
    type: accountType,
  };
}

function filterNonEmpty(values: string[] | undefined): string[] {
  return (values ?? []).filter(Boolean);
}

function optionalStringList(values: string[] | undefined): string[] | undefined {
  const filtered = filterNonEmpty(values);
  return filtered.length > 0 ? filtered : undefined;
}

function buildStatementPayload(form: AccountWritePayload | AccountUpdatePayload) {
  const text_contains = optionalStringList(form.statement?.text_contains);
  const text_not_contains = optionalStringList(form.statement?.text_not_contains);
  if (!text_contains && !text_not_contains) {
    return undefined;
  }
  return {
    ...(text_contains ? { text_contains } : {}),
    ...(text_not_contains ? { text_not_contains } : {}),
  };
}

function buildMailPayload(form: AccountWritePayload | AccountUpdatePayload) {
  const subjects = optionalStringList(form.mail?.subjects);
  const body_contains = optionalStringList(form.mail?.body_contains);
  const from = optionalStringList(form.mail?.from);
  if (!subjects && !body_contains && !from) {
    return undefined;
  }
  return {
    ...(subjects ? { subjects } : {}),
    ...(body_contains ? { body_contains } : {}),
    ...(from ? { from } : {}),
  };
}

export async function formToAccountBody(
  dek: CryptoKey,
  form: AccountWritePayload | AccountUpdatePayload
): Promise<Record<string, unknown>> {
  const accountNumber = form.account_number.trim();
  const passwords = (form.passwords ?? []).filter(Boolean);
  const body: Record<string, unknown> = {
    bank: form.bank,
    variant: normalizeVariantForPayload(form.variant),
    account_type: form.type ?? "credit_card",
    opening_date: toIsoAccountDate(form.opening_date),
    closing_date: form.closing_date?.trim() ? toIsoAccountDate(form.closing_date) : null,
    account_number: await sealField(dek, accountNumber),
  };

  if (passwords.length > 0) {
    body.passwords = passwords;
  }

  const statement = buildStatementPayload(form);
  if (statement) {
    body.statement_rules = statement;
  }

  const mail = buildMailPayload(form);
  if (mail) {
    body.mail_rules = mail;
  }

  return body;
}

export function toAccountUpdatePayload(form: AccountWritePayload): AccountUpdatePayload {
  return { ...form };
}

export function normalizeVariantForPayload(variant: string | null | undefined): string | null {
  if (!variant || variant.toLowerCase() === "default") {
    return null;
  }
  return variant;
}

export function variantSelectValue(variant: string | null | undefined): string {
  return normalizeVariantForPayload(variant) ?? "";
}

export function sortBankVariants(items: BankVariant[]): BankVariant[] {
  return [...items].sort((left, right) => {
    const leftDefault = isDefaultVariant(left.variant);
    const rightDefault = isDefaultVariant(right.variant);
    if (leftDefault !== rightDefault) {
      return leftDefault ? 1 : -1;
    }
    return (left.variant ?? "").localeCompare(right.variant ?? "");
  });
}

export function hasAdvancedOptions(form: AccountWritePayload): boolean {
  return (
    (form.statement?.text_contains ?? []).some(Boolean) ||
    (form.statement?.text_not_contains ?? []).some(Boolean) ||
    (form.mail?.subjects ?? []).some(Boolean) ||
    (form.mail?.body_contains ?? []).some(Boolean) ||
    (form.mail?.from ?? []).some(Boolean)
  );
}
