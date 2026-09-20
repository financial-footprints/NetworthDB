import { beforeAll, describe, expect, test } from "bun:test";
import { MAX_RULE_GROUPS_PER_USER } from "@core/domains/account/rules/constants";
import { RuleGroupService } from "@core/domains/account/rules/services/rule-group-service";
import { RuleService } from "@core/domains/account/rules/services/rule-service";
import { User, Username } from "@core/domains/user/entities/user/index";
import { ValidationError } from "@core/shared/errors/domain-error";
import { InMemoryRuleGroupRepository } from "@core/tests/fakes/in-memory-rule-group-repository";
import { InMemoryRuleRepository } from "@core/tests/fakes/in-memory-rule-repository";

const AAL2 = "aal2";

describe("RuleGroupService", () => {
  let user: User;
  let groupRepo: InMemoryRuleGroupRepository;
  let ruleRepo: InMemoryRuleRepository;
  let groups: RuleGroupService;
  let rules: RuleService;

  beforeAll(() => {
    user = new User(
      crypto.randomUUID(),
      Username.parse("rule_group_user"),
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
    const created = await groups.create(user, AAL2, { title: "Ingest" });
    const listed = await groups.list(user, AAL2, { limit: 10, offset: 0 });
    expect(listed.total).toBe(1);
    const fetched = await groups.get(user, AAL2, created.id);
    expect(fetched.title).toBe("Ingest");
    const updated = await groups.update(user, AAL2, created.id, {
      title: "Renamed",
      active: false,
    });
    expect(updated.active).toBe(false);
    await groups.delete(user, AAL2, created.id);
    const after = await groups.list(user, AAL2, { limit: 10, offset: 0 });
    expect(after.total).toBe(0);
  });

  test("delete group removes child rules", async () => {
    const group = await groups.create(user, AAL2, { title: "With rules" });
    await rules.create(user, AAL2, group.id, {
      title: "Rule",
      when: { op: "and", items: [{ type: "has_no_category" }] },
      actions: [{ type: "clear_tags" }],
    });
    const before = await rules.list(user, AAL2, {
      groupId: group.id,
      limit: 10,
      offset: 0,
    });
    expect(before.total).toBe(1);
    const ruleId = before.items[0]?.id ?? "";
    await groups.delete(user, AAL2, group.id);
    expect(await ruleRepo.findById(user.id, ruleId)).toBeNull();
  });

  test("rejects more than max groups", async () => {
    const overflowUser = new User(
      crypto.randomUUID(),
      Username.parse("overflow_user"),
      "hash",
      "user",
      true,
      new Date()
    );
    const repo = new InMemoryRuleGroupRepository();
    const rulesRepo = new InMemoryRuleRepository();
    const service = new RuleGroupService(repo, rulesRepo);
    for (let index = 0; index < MAX_RULE_GROUPS_PER_USER; index += 1) {
      await service.create(overflowUser, AAL2, { title: `Group ${index}` });
    }
    await expect(service.create(overflowUser, AAL2, { title: "Overflow" })).rejects.toBeInstanceOf(
      ValidationError
    );
  });
});
