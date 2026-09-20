import {
  MAX_RULE_DESCRIPTION_LEN,
  MAX_RULE_TITLE_LEN,
} from "@core/domains/account/rules/constants";
import { ValidationError } from "@core/shared/errors/domain-error";

function normalizeTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed || trimmed.length > MAX_RULE_TITLE_LEN) {
    throw new ValidationError("Rule group title is invalid.", {
      field: "title",
      context: { max: MAX_RULE_TITLE_LEN },
    });
  }
  return trimmed;
}

function normalizeDescription(description: string | null | undefined): string | null {
  if (description === undefined || description === null) {
    return null;
  }
  const trimmed = description.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.length > MAX_RULE_DESCRIPTION_LEN) {
    throw new ValidationError("Rule group description is invalid.", {
      field: "description",
      context: { max: MAX_RULE_DESCRIPTION_LEN },
    });
  }
  return trimmed;
}

export class TransactionRuleGroup {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly sortOrder: number,
    public readonly active: boolean,
    public readonly title: string,
    public readonly description: string | null,
    public readonly createdAt: string,
    public readonly updatedAt: string
  ) {}

  static create(props: {
    id?: string;
    userId: string;
    sortOrder?: number;
    active?: boolean;
    title: string;
    description?: string | null;
    createdAt?: string;
    updatedAt?: string;
  }): TransactionRuleGroup {
    const now = new Date().toISOString();
    return new TransactionRuleGroup(
      props.id ?? crypto.randomUUID(),
      props.userId,
      props.sortOrder ?? 0,
      props.active ?? true,
      normalizeTitle(props.title),
      normalizeDescription(props.description),
      props.createdAt ?? now,
      props.updatedAt ?? now
    );
  }

  withUpdates(input: {
    title?: string;
    description?: string | null;
    sortOrder?: number;
    active?: boolean;
    updatedAt: string;
  }): TransactionRuleGroup {
    return new TransactionRuleGroup(
      this.id,
      this.userId,
      input.sortOrder ?? this.sortOrder,
      input.active ?? this.active,
      input.title !== undefined ? normalizeTitle(input.title) : this.title,
      input.description !== undefined ? normalizeDescription(input.description) : this.description,
      this.createdAt,
      input.updatedAt
    );
  }
}
