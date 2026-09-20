import { MAX_RULES_PER_GROUP } from "@core/domains/account/rules/constants";
import { parseActionsJson, parseWhenJson } from "@core/domains/account/rules/embedded/helpers";
import type { RuleAction, RuleExpression } from "@core/domains/account/rules/embedded/types";
import { TransactionRule } from "@core/domains/account/rules/entities/transaction-rule";
import type { RuleGroupRepository } from "@core/domains/account/rules/repositories/rule-group-repository";
import type {
  RuleFilters,
  RuleRepository,
} from "@core/domains/account/rules/repositories/rule-repository";
import { assertAal2 } from "@core/domains/auth/helpers";
import type { User } from "@core/domains/user/entities/user/index";
import { EntityNotFoundError, ValidationError } from "@core/shared/errors/domain-error";

export type RuleListQuery = {
  groupId: string;
  limit: number;
  offset: number;
};

export class RuleService {
  constructor(
    private readonly rules: RuleRepository,
    private readonly groups: RuleGroupRepository
  ) {}

  async list(
    user: User,
    authAcr: string,
    query: RuleListQuery
  ): Promise<{ items: TransactionRule[]; total: number }> {
    assertAal2(user.multifactorEnabled, authAcr);
    await this.requireGroup(user.id, query.groupId);
    const filters: RuleFilters = { userId: user.id, groupId: query.groupId };
    const [items, total] = await Promise.all([
      this.rules.findByFilters(
        filters,
        { column: "sort_order", direction: "asc" },
        { limit: query.limit, offset: query.offset }
      ),
      this.rules.aggregate(filters),
    ]);
    return { items, total };
  }

  async get(user: User, authAcr: string, id: string): Promise<TransactionRule> {
    assertAal2(user.multifactorEnabled, authAcr);
    const row = await this.rules.findById(user.id, id);
    if (!row) {
      throw new EntityNotFoundError("Rule", id);
    }
    return row;
  }

  async create(
    user: User,
    authAcr: string,
    groupId: string,
    input: {
      title: string;
      description?: string | null;
      sortOrder?: number;
      active?: boolean;
      stopProcessing?: boolean;
      runOnCreate?: boolean;
      when: unknown;
      actions: unknown;
    }
  ): Promise<TransactionRule> {
    assertAal2(user.multifactorEnabled, authAcr);
    await this.requireGroup(user.id, groupId);
    const total = await this.rules.aggregate({ userId: user.id, groupId });
    if (total >= MAX_RULES_PER_GROUP) {
      throw new ValidationError("Rule limit reached.", {
        context: { max: MAX_RULES_PER_GROUP },
      });
    }
    const when = parseWhenJson(input.when);
    const actions = parseActionsJson(input.actions);
    const row = TransactionRule.create({
      userId: user.id,
      groupId,
      title: input.title,
      description: input.description,
      sortOrder: input.sortOrder,
      active: input.active,
      stopProcessing: input.stopProcessing,
      runOnCreate: input.runOnCreate,
      when,
      actions,
    });
    return this.rules.create(row);
  }

  async update(
    user: User,
    authAcr: string,
    id: string,
    input: {
      title?: string;
      description?: string | null;
      sortOrder?: number;
      active?: boolean;
      stopProcessing?: boolean;
      runOnCreate?: boolean;
      when?: unknown;
      actions?: unknown;
    }
  ): Promise<TransactionRule> {
    assertAal2(user.multifactorEnabled, authAcr);
    const existing = await this.rules.findById(user.id, id);
    if (!existing) {
      throw new EntityNotFoundError("Rule", id);
    }
    let when: RuleExpression | undefined;
    let actions: RuleAction[] | undefined;
    if (input.when !== undefined) {
      when = parseWhenJson(input.when);
    }
    if (input.actions !== undefined) {
      actions = parseActionsJson(input.actions);
    }
    const updated = existing.withUpdates({
      title: input.title,
      description: input.description,
      sortOrder: input.sortOrder,
      active: input.active,
      stopProcessing: input.stopProcessing,
      runOnCreate: input.runOnCreate,
      when,
      actions,
      updatedAt: new Date().toISOString(),
    });
    return this.rules.save(updated);
  }

  async delete(user: User, authAcr: string, id: string): Promise<void> {
    assertAal2(user.multifactorEnabled, authAcr);
    const deleted = await this.rules.delete(user.id, id);
    if (!deleted) {
      throw new EntityNotFoundError("Rule", id);
    }
  }

  private async requireGroup(userId: string, groupId: string): Promise<void> {
    const group = await this.groups.findById(userId, groupId);
    if (!group) {
      throw new EntityNotFoundError("RuleGroup", groupId);
    }
  }
}
