import { MAX_RULE_GROUPS_PER_USER } from "@core/domains/account/rules/constants";
import { TransactionRuleGroup } from "@core/domains/account/rules/entities/transaction-rule-group";
import type {
  RuleGroupFilters,
  RuleGroupRepository,
} from "@core/domains/account/rules/repositories/rule-group-repository";
import type { RuleRepository } from "@core/domains/account/rules/repositories/rule-repository";
import { assertAal2 } from "@core/domains/auth/helpers";
import type { User } from "@core/domains/user/entities/user/index";
import { EntityNotFoundError, ValidationError } from "@core/shared/errors/domain-error";

export type RuleGroupListQuery = {
  limit: number;
  offset: number;
};

export class RuleGroupService {
  constructor(
    private readonly groups: RuleGroupRepository,
    private readonly rules: RuleRepository
  ) {}

  async list(
    user: User,
    authAcr: string,
    query: RuleGroupListQuery
  ): Promise<{ items: TransactionRuleGroup[]; total: number }> {
    assertAal2(user.multifactorEnabled, authAcr);
    const filters: RuleGroupFilters = { userId: user.id };
    const [items, total] = await Promise.all([
      this.groups.findByFilters(
        filters,
        { column: "sort_order", direction: "asc" },
        { limit: query.limit, offset: query.offset }
      ),
      this.groups.aggregate(filters),
    ]);
    return { items, total };
  }

  async get(user: User, authAcr: string, id: string): Promise<TransactionRuleGroup> {
    assertAal2(user.multifactorEnabled, authAcr);
    const row = await this.groups.findById(user.id, id);
    if (!row) {
      throw new EntityNotFoundError("RuleGroup", id);
    }
    return row;
  }

  async create(
    user: User,
    authAcr: string,
    input: {
      title: string;
      description?: string | null;
      sortOrder?: number;
      active?: boolean;
    }
  ): Promise<TransactionRuleGroup> {
    assertAal2(user.multifactorEnabled, authAcr);
    const total = await this.groups.aggregate({ userId: user.id });
    if (total >= MAX_RULE_GROUPS_PER_USER) {
      throw new ValidationError("Rule group limit reached.", {
        context: { max: MAX_RULE_GROUPS_PER_USER },
      });
    }
    const row = TransactionRuleGroup.create({
      userId: user.id,
      title: input.title,
      description: input.description,
      sortOrder: input.sortOrder,
      active: input.active,
    });
    return this.groups.create(row);
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
    }
  ): Promise<TransactionRuleGroup> {
    assertAal2(user.multifactorEnabled, authAcr);
    const existing = await this.groups.findById(user.id, id);
    if (!existing) {
      throw new EntityNotFoundError("RuleGroup", id);
    }
    const updated = existing.withUpdates({
      ...input,
      updatedAt: new Date().toISOString(),
    });
    return this.groups.save(updated);
  }

  async delete(user: User, authAcr: string, id: string): Promise<void> {
    assertAal2(user.multifactorEnabled, authAcr);
    const existing = await this.groups.findById(user.id, id);
    if (!existing) {
      throw new EntityNotFoundError("RuleGroup", id);
    }
    await this.rules.deleteByGroup(user.id, id);
    const deleted = await this.groups.delete(user.id, id);
    if (!deleted) {
      throw new EntityNotFoundError("RuleGroup", id);
    }
  }
}
