import defaultEmptyIllustration from "@web/assets/images/illustrations/empty.svg";
import { PrimaryButton } from "@web/components/Button";
import { PageBoundary } from "@web/components/Layout/PageBoundary";
import { PageHeading } from "@web/components/Layout/PageHeading";
import { PageTitle } from "@web/components/Layout/PageTitle";
import { StatusView } from "@web/components/Layout/StatusView";
import { Search } from "@web/components/List/Search";
import { Toolbar } from "@web/components/List/Toolbar";
import { useListQuery } from "@web/hooks/query";
import { Apply, type RuleApplyTarget } from "@web/routes/rules/_parts/Apply";
import { Group } from "@web/routes/rules/_parts/Group";
import { GroupModal } from "@web/routes/rules/_parts/GroupModal";
import type { RuleTextCatalogs } from "@web/routes/rules/_parts/text";
import { RulesPageSkeleton } from "@web/routes/rules/suspense";
import { readAccounts } from "@web/utils/api/routes/accounts";
import { fetchCategories } from "@web/utils/api/routes/categories";
import {
  deleteRuleGroup,
  fetchRuleGroups,
  patchRuleGroup,
} from "@web/utils/api/routes/rule-groups";
import type { RuleGroupApi } from "@web/utils/api/routes/rule-groups/types";
import { deleteRule, fetchRules, patchRule } from "@web/utils/api/routes/rules";
import type { RuleApi } from "@web/utils/api/routes/rules/types";
import { fetchTags } from "@web/utils/api/routes/tags";
import { fetchSystemAccounts } from "@web/utils/api/routes/transactions";
import { errorMessage } from "@web/utils/errors";
import { searchQuery } from "@web/utils/list";
import { useCallback, useEffect, useMemo, useState } from "react";

const emptyCatalogs: RuleTextCatalogs = { accounts: [], categories: [], tags: [] };

export function Content() {
  const listQuery = useListQuery(searchQuery);
  const [groups, setGroups] = useState<RuleGroupApi[]>([]);
  const [rulesByGroup, setRulesByGroup] = useState<Map<string, RuleApi[]>>(new Map());
  const [catalogs, setCatalogs] = useState<RuleTextCatalogs>(emptyCatalogs);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<RuleGroupApi | null>(null);
  const [applyTarget, setApplyTarget] = useState<RuleApplyTarget | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [groupResponse, accounts, systemAccounts, categoryResponse, tagResponse] =
        await Promise.all([
          fetchRuleGroups({ limit: 200 }),
          readAccounts({ status: "all" }),
          fetchSystemAccounts(),
          fetchCategories({ limit: 200 }),
          fetchTags({ limit: 200 }),
        ]);
      const groupItems = groupResponse.items;
      setGroups(groupItems);
      const ruleEntries = await Promise.all(
        groupItems.map(async (group) => {
          const rulesResponse = await fetchRules({ groupId: group.id, limit: 200 });
          return [group.id, rulesResponse.items] as const;
        })
      );
      setRulesByGroup(new Map(ruleEntries));
      setCatalogs({
        accounts: [
          ...accounts.accounts.map((account) => ({ id: account.id, label: account.label })),
          ...systemAccounts.map((account) => ({ id: account.id, label: account.label })),
        ],
        categories: categoryResponse.items.map((category) => ({
          id: category.id,
          name: category.name,
          parentId: category.parentId,
        })),
        tags: tagResponse.items.map((tag) => ({ id: tag.id, name: tag.name })),
      });
    } catch (err: unknown) {
      setError(errorMessage(err, "Could not load rules"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredGroups = useMemo(() => {
    const q = listQuery.search.trim().toLowerCase();
    if (!q) {
      return groups;
    }
    return groups.filter((group) => {
      if (group.title.toLowerCase().includes(q)) {
        return true;
      }
      const rules = rulesByGroup.get(group.id) ?? [];
      return rules.some((rule) => rule.title.toLowerCase().includes(q));
    });
  }, [groups, rulesByGroup, listQuery.search]);

  const searchActive = listQuery.search.trim().length > 0;
  const showEmptyState = !loading && !error && filteredGroups.length === 0;
  const emptyTitle =
    searchActive || groups.length > 0 ? "No Rule Groups Match" : "No Rule Groups Yet";
  const emptyMessage =
    searchActive || groups.length > 0
      ? "Try a different search term."
      : "Create rule groups to classify transactions automatically.";

  async function moveRule(groupId: string, index: number, direction: -1 | 1) {
    const rules = [...(rulesByGroup.get(groupId) ?? [])];
    const nextIndex = index + direction;
    const current = rules[index];
    const neighbor = rules[nextIndex];
    if (!current || !neighbor) {
      return;
    }
    rules[index] = neighbor;
    rules[nextIndex] = current;
    await Promise.all(rules.map((rule, sortOrder) => patchRule(rule.id, { sortOrder })));
    await load();
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageTitle page="Rules" />
      <PageBoundary errorTitle="Could not load rules" onRetry={() => void load()}>
        <PageHeading
          title="Rules"
          action={
            <PrimaryButton type="button" onClick={() => setCreateGroupOpen(true)}>
              Add Rule Group
            </PrimaryButton>
          }
        />
        <Toolbar
          search={
            <Search
              value={listQuery.searchInput}
              placeholder="Search Groups or Rules"
              onChange={listQuery.setSearchInput}
            />
          }
        />
        {loading ? <RulesPageSkeleton /> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {showEmptyState ? (
          <StatusView
            illustration={defaultEmptyIllustration}
            title={emptyTitle}
            message={emptyMessage}
            actions={
              !searchActive && groups.length === 0 ? (
                <PrimaryButton type="button" onClick={() => setCreateGroupOpen(true)}>
                  Add Rule Group
                </PrimaryButton>
              ) : undefined
            }
          />
        ) : null}
        {!showEmptyState && !loading && !error ? (
          <div className="space-y-3">
            {filteredGroups.map((group) => (
              <Group
                key={group.id}
                group={group}
                rules={rulesByGroup.get(group.id) ?? []}
                catalogs={catalogs}
                onToggleGroupActive={async (target) => {
                  await patchRuleGroup(target.id, { active: !target.active });
                  await load();
                }}
                onApplyGroup={(target) =>
                  setApplyTarget({ type: "group", id: target.id, title: target.title })
                }
                onEditGroup={setEditGroup}
                onDeleteGroup={async (target) => {
                  await deleteRuleGroup(target.id);
                  await load();
                }}
                onApplyRule={(rule) =>
                  setApplyTarget({ type: "rule", id: rule.id, title: rule.title })
                }
                onDeleteRule={async (rule) => {
                  await deleteRule(rule.id);
                  await load();
                }}
                onMoveRule={moveRule}
                onRuleChanged={load}
              />
            ))}
          </div>
        ) : null}
      </PageBoundary>
      <GroupModal
        isOpen={createGroupOpen}
        mode="create"
        onClose={() => setCreateGroupOpen(false)}
        onSaved={() => void load()}
      />
      <GroupModal
        isOpen={editGroup !== null}
        mode="edit"
        groupId={editGroup?.id}
        initialTitle={editGroup?.title}
        initialDescription={editGroup?.description}
        onClose={() => setEditGroup(null)}
        onSaved={() => void load()}
      />
      <Apply
        isOpen={applyTarget !== null}
        target={applyTarget}
        onClose={() => setApplyTarget(null)}
      />
    </div>
  );
}
