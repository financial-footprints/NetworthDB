import { MAX_TAGS_PER_TRANSACTION } from "@core/domains/account/taxonomy/constants";
import { ValidationError } from "@core/shared/errors/domain-error";
import { Time } from "@core/shared/time";
import {
  assertTransactionText,
  MAX_DESCRIPTION_LEN,
  MAX_REF_NO_LEN,
} from "@core/shared/transaction-text";

function dedupeTagIds(tagIds: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of tagIds) {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

export class Transaction {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly date: string,
    public readonly amount: number,
    public readonly sourceAccountId: string,
    public readonly destinationAccountId: string,
    public readonly description: string,
    public readonly refNo: string | null,
    public readonly importId: string | null,
    public readonly categoryId: string | null,
    public readonly subcategoryId: string | null,
    public readonly tagIds: string[],
    public readonly createdAt: string,
    public readonly updatedAt: string
  ) {}

  static create(props: {
    id?: string;
    userId: string;
    date: string;
    amount: number;
    sourceAccountId: string;
    destinationAccountId: string;
    description: string;
    refNo?: string | null;
    importId?: string | null;
    categoryId?: string | null;
    subcategoryId?: string | null;
    tagIds?: string[];
    createdAt?: string;
    updatedAt?: string;
  }): Transaction {
    const date = Time.parseIsoDate(props.date, "date");
    Transaction.validateAmount(props.amount);
    if (props.sourceAccountId === props.destinationAccountId) {
      throw new ValidationError("Source and destination accounts must differ.");
    }
    assertTransactionText(props.description, "description", MAX_DESCRIPTION_LEN, false);
    if (props.refNo != null && props.refNo.trim() !== "") {
      assertTransactionText(props.refNo, "ref_no", MAX_REF_NO_LEN, false);
    }

    const categoryId = props.categoryId ?? null;
    const subcategoryId = props.subcategoryId ?? null;
    if (subcategoryId !== null && categoryId === null) {
      throw new ValidationError("Subcategory requires a parent category.");
    }

    const tagIds = dedupeTagIds(props.tagIds ?? []);
    if (tagIds.length > MAX_TAGS_PER_TRANSACTION) {
      throw new ValidationError("Too many tags.", {
        field: "tagIds",
        context: { max: MAX_TAGS_PER_TRANSACTION, count: tagIds.length },
      });
    }

    const now = new Date().toISOString();
    return new Transaction(
      props.id ?? crypto.randomUUID(),
      props.userId,
      date,
      props.amount,
      props.sourceAccountId,
      props.destinationAccountId,
      props.description.trim(),
      props.refNo?.trim() ? props.refNo.trim() : null,
      props.importId ?? null,
      categoryId,
      subcategoryId,
      tagIds,
      props.createdAt ?? now,
      props.updatedAt ?? now
    );
  }

  static validateAmount(amount: number): void {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new ValidationError("Amount must be positive.", {
        field: "amount",
        value: amount,
      });
    }
  }

  withUpdates(input: {
    date: string;
    amount: number;
    sourceAccountId: string;
    destinationAccountId: string;
    description: string;
    refNo?: string | null;
    categoryId: string | null;
    subcategoryId: string | null;
    tagIds: string[];
    updatedAt: string;
  }): Transaction {
    return Transaction.create({
      id: this.id,
      userId: this.userId,
      date: input.date,
      amount: input.amount,
      sourceAccountId: input.sourceAccountId,
      destinationAccountId: input.destinationAccountId,
      description: input.description,
      refNo: input.refNo,
      importId: this.importId,
      categoryId: input.categoryId,
      subcategoryId: input.subcategoryId,
      tagIds: input.tagIds,
      createdAt: this.createdAt,
      updatedAt: input.updatedAt,
    });
  }

  involvesAccount(accountId: string): boolean {
    return this.sourceAccountId === accountId || this.destinationAccountId === accountId;
  }
}
