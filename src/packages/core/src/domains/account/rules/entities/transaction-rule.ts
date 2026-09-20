import {
  MAX_RULE_DESCRIPTION_LEN,
  MAX_RULE_TITLE_LEN,
} from "@core/domains/account/rules/constants";
import type { RuleAction, RuleExpression } from "@core/domains/account/rules/embedded/types";
import { ValidationError } from "@core/shared/errors/domain-error";

function normalizeTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed || trimmed.length > MAX_RULE_TITLE_LEN) {
    throw new ValidationError("Rule title is invalid.", {
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
    throw new ValidationError("Rule description is invalid.", {
      field: "description",
      context: { max: MAX_RULE_DESCRIPTION_LEN },
    });
  }
  return trimmed;
}

export class TransactionRule {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly groupId: string,
    public readonly sortOrder: number,
    public readonly active: boolean,
    public readonly stopProcessing: boolean,
    public readonly runOnCreate: boolean,
    public readonly title: string,
    public readonly description: string | null,
    public readonly when: RuleExpression,
    public readonly actions: RuleAction[],
    public readonly createdAt: string,
    public readonly updatedAt: string
  ) {}

  static create(props: {
    id?: string;
    userId: string;
    groupId: string;
    sortOrder?: number;
    active?: boolean;
    stopProcessing?: boolean;
    runOnCreate?: boolean;
    title: string;
    description?: string | null;
    when: RuleExpression;
    actions: RuleAction[];
    createdAt?: string;
    updatedAt?: string;
  }): TransactionRule {
    const now = new Date().toISOString();
    return new TransactionRule(
      props.id ?? crypto.randomUUID(),
      props.userId,
      props.groupId,
      props.sortOrder ?? 0,
      props.active ?? true,
      props.stopProcessing ?? false,
      props.runOnCreate ?? true,
      normalizeTitle(props.title),
      normalizeDescription(props.description),
      props.when,
      props.actions,
      props.createdAt ?? now,
      props.updatedAt ?? now
    );
  }

  withUpdates(input: {
    sortOrder?: number;
    active?: boolean;
    stopProcessing?: boolean;
    runOnCreate?: boolean;
    title?: string;
    description?: string | null;
    when?: RuleExpression;
    actions?: RuleAction[];
    updatedAt: string;
  }): TransactionRule {
    return new TransactionRule(
      this.id,
      this.userId,
      this.groupId,
      input.sortOrder ?? this.sortOrder,
      input.active ?? this.active,
      input.stopProcessing ?? this.stopProcessing,
      input.runOnCreate ?? this.runOnCreate,
      input.title !== undefined ? normalizeTitle(input.title) : this.title,
      input.description !== undefined ? normalizeDescription(input.description) : this.description,
      input.when ?? this.when,
      input.actions ?? this.actions,
      this.createdAt,
      input.updatedAt
    );
  }
}
