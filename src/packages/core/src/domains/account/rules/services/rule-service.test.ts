import { beforeAll, describe, expect, test } from "bun:test";
import { MAX_RULES_PER_GROUP } from "@core/domains/account/rules/constants";
import { RuleGroupService } from "@core/domains/account/rules/services/rule-group-service";
import { RuleService } from "@core/domains/account/rules/services/rule-service";
import { User, Username } from "@core/domains/user/entities/user/index";
import { EntityNotFoundError, ValidationError } from "@core/shared/errors/domain-error";
import { InMemoryRuleGroupRepository } from "@core/tests/fakes/in-memory-rule-group-repository";
import { InMemoryRuleRepository } from "@core/tests/fakes/in-memory-rule-repository";

const AAL2 = "aal2";

describe("RuleService", () => {
  let user: User;
  let groupRepo: InMemoryRuleGroupRepository;
  let ruleRepo: InMemoryRuleRepository;
  let groups: RuleGroupService;
  let rules: RuleService;

  beforeAll(() => {
    user = new User(
      crypto.randomUUID(),
      Username.parse("rule_user"),
      "hash",
      "user",
      true,
      new Date()
    );
    groupRepo = new InMemoryRuleGroupRepository();
    ruleRepo = new InMemoryRuleRepository();
    groups = new RuleGroupService(groupRepo, ruleRepo);
    rules = new RuleService(ruleRepo, groupRepo);
  });

  test("create list get update delete", async () => {
    const group = await groups.create(user, AAL2, { title: "G1" });
    const created = await rules.create(user, AAL2, group.id, {
      title: "Classify",
      when: { op: "and", items: [{ type: "description_contains", value: "amazon" }] },
      actions: [{ type: "clear_tags" }],
    });
    const listed = await rules.list(user, AAL2, { groupId: group.id, limit: 10, offset: 0 });
    expect(listed.total).toBe(1);
    const fetched = await rules.get(user, AAL2, created.id);
    expect(fetched.title).toBe("Classify");
    const updated = await rules.update(user, AAL2, created.id, {
      runOnCreate: false,
    });
    expect(updated.runOnCreate).toBe(false);
    await rules.delete(user, AAL2, created.id);
    const after = await rules.list(user, AAL2, { groupId: group.id, limit: 10, offset: 0 });
    expect(after.total).toBe(0);
  });

  test("rejects unknown trigger type", async () => {
    const group = await groups.create(user, AAL2, { title: "G2" });
    await expect(
      rules.create(user, AAL2, group.id, {
        title: "Bad",
        when: { op: "and", items: [{ type: "not_a_trigger", value: "x" }] },
        actions: [],
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  test("rejects too many triggers", async () => {
    const group = await groups.create(user, AAL2, { title: "G3" });
    const triggers = Array.from({ length: 21 }, () => ({
      type: "has_no_category" as const,
    }));
    await expect(
      rules.create(user, AAL2, group.id, {
        title: "Too many",
        when: { op: "and", items: triggers },
        actions: [],
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  test("rejects an empty when group", async () => {
    const group = await groups.create(user, AAL2, { title: "G4" });
    await expect(
      rules.create(user, AAL2, group.id, {
        title: "Empty",
        when: { op: "and", items: [] },
        actions: [],
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  test("create without group fails", async () => {
    await expect(
      rules.create(user, AAL2, crypto.randomUUID(), {
        title: "Orphan",
        when: { type: "has_no_category" },
        actions: [],
      })
    ).rejects.toBeInstanceOf(EntityNotFoundError);
  });

  test("rejects more than max rules per group", async () => {
    const overflowUser = new User(
      crypto.randomUUID(),
      Username.parse("rule_overflow"),
      "hash",
      "user",
      true,
      new Date()
    );
    const gRepo = new InMemoryRuleGroupRepository();
    const rRepo = new InMemoryRuleRepository();
    const gService = new RuleGroupService(gRepo, rRepo);
    const rService = new RuleService(rRepo, gRepo);
    const group = await gService.create(overflowUser, AAL2, { title: "Full" });
    for (let index = 0; index < MAX_RULES_PER_GROUP; index += 1) {
      await rService.create(overflowUser, AAL2, group.id, {
        title: `R${index}`,
        when: { op: "and", items: [{ type: "has_no_category" }] },
        actions: [{ type: "clear_tags" }],
      });
    }
    await expect(
      rService.create(overflowUser, AAL2, group.id, {
        title: "Overflow",
        when: { op: "and", items: [{ type: "has_no_category" }] },
        actions: [{ type: "clear_tags" }],
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
