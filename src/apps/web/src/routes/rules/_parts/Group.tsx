import { ConfirmDeleteButton, IconActionButton } from "@web/components/Button";
import { path } from "@web/router/path";
import {
  formatRuleWhen,
  type RuleExpression,
  type RuleTextCatalogs,
} from "@web/routes/rules/_parts/text";
import type { RuleGroupApi } from "@web/utils/api/routes/rule-groups/types";
import { patchRule } from "@web/utils/api/routes/rules";
import type { RuleApi } from "@web/utils/api/routes/rules/types";
import { useState } from "react";
import {
  LuArrowDown,
  LuArrowUp,
  LuChevronDown,
  LuChevronRight,
  LuPencil,
  LuPlay,
  LuPlus,
} from "react-icons/lu";
import { useNavigate } from "react-router-dom";

type RuleGroupSectionProps = {
  group: RuleGroupApi;
  rules: RuleApi[];
  catalogs: RuleTextCatalogs;
  onToggleGroupActive: (group: RuleGroupApi) => Promise<void>;
  onApplyGroup: (group: RuleGroupApi) => void;
  onEditGroup: (group: RuleGroupApi) => void;
  onDeleteGroup: (group: RuleGroupApi) => Promise<void>;
  onApplyRule: (rule: RuleApi) => void;
  onDeleteRule: (rule: RuleApi) => Promise<void>;
  onMoveRule: (groupId: string, index: number, direction: -1 | 1) => Promise<void>;
  onRuleChanged: () => Promise<void>;
};

function ruleCountLabel(count: number): string {
  if (count === 0) {
    return "No rules";
  }
  return count === 1 ? "1 rule" : `${count} rules`;
}

function asExpression(value: unknown): RuleExpression | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as RuleExpression;
}

function preview(rule: RuleApi, catalogs: RuleTextCatalogs): string {
  const expression = asExpression(rule.when);
  if (!expression) {
    return "Could not read conditions";
  }
  try {
    const line = formatRuleWhen(expression, catalogs).replaceAll("\n", " ");
    const notes = [
      line,
      rule.active ? null : "Paused",
      rule.runOnCreate ? null : "Manual only",
    ].filter((part): part is string => part !== null);
    return notes.join(" · ");
  } catch {
    return "Could not read conditions";
  }
}

export function Group({
  group,
  rules,
  catalogs,
  onToggleGroupActive,
  onApplyGroup,
  onEditGroup,
  onDeleteGroup,
  onApplyRule,
  onDeleteRule,
  onMoveRule,
  onRuleChanged,
}: RuleGroupSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const navigate = useNavigate();
  const subtitle = [group.description, ruleCountLabel(rules.length), group.active ? null : "Paused"]
    .filter((part): part is string => Boolean(part))
    .join(" · ");

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          className="flex size-8 shrink-0 items-center justify-center rounded-sm text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          aria-expanded={expanded}
          aria-label={expanded ? `Collapse ${group.title}` : `Expand ${group.title}`}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? (
            <LuChevronDown className="size-4" strokeWidth={1.75} aria-hidden />
          ) : (
            <LuChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{group.title}</p>
          <p className="truncate text-xs text-slate-500">{subtitle}</p>
        </div>
        <button
          type="button"
          className="text-xs text-slate-500 transition hover:text-slate-700"
          onClick={() => void onToggleGroupActive(group)}
        >
          {group.active ? "Pause" : "Resume"}
        </button>
        <div className="flex shrink-0 items-center gap-0.5">
          <IconActionButton
            title="Add Rule"
            onClick={() => navigate(`${path.rules.create}?groupId=${group.id}`)}
          >
            <LuPlus className="size-4" strokeWidth={1.75} aria-hidden />
          </IconActionButton>
          <IconActionButton title="Edit" tone="edit" onClick={() => onEditGroup(group)}>
            <LuPencil className="size-4" strokeWidth={1.75} aria-hidden />
          </IconActionButton>
          <IconActionButton title="Apply" onClick={() => onApplyGroup(group)}>
            <LuPlay className="size-4" strokeWidth={1.75} aria-hidden />
          </IconActionButton>
          <ConfirmDeleteButton
            variant="icon"
            title="Delete"
            confirmMessage="Delete this rule group and all rules inside it?"
            onDelete={() => onDeleteGroup(group)}
          />
        </div>
      </div>
      {expanded ? (
        <ul className="divide-y divide-slate-100 border-t border-slate-100">
          {rules.length === 0 ? (
            <li className="px-3 py-3 pl-12 text-sm text-slate-500">No rules yet.</li>
          ) : (
            rules.map((rule, index) => (
              <li key={rule.id} className="flex items-center gap-2 py-1.5 pr-3 pl-12">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-slate-700">{rule.title}</p>
                  <p className="truncate text-xs text-slate-500">{preview(rule, catalogs)}</p>
                </div>
                <button
                  type="button"
                  className="text-xs text-slate-500 transition hover:text-slate-700"
                  onClick={() =>
                    void patchRule(rule.id, { active: !rule.active }).then(() => onRuleChanged())
                  }
                >
                  {rule.active ? "Pause" : "Resume"}
                </button>
                {rules.length > 1 ? (
                  <>
                    <IconActionButton
                      title="Move Up"
                      disabled={index === 0}
                      onClick={() => void onMoveRule(group.id, index, -1)}
                    >
                      <LuArrowUp className="size-4" strokeWidth={1.75} aria-hidden />
                    </IconActionButton>
                    <IconActionButton
                      title="Move Down"
                      disabled={index === rules.length - 1}
                      onClick={() => void onMoveRule(group.id, index, 1)}
                    >
                      <LuArrowDown className="size-4" strokeWidth={1.75} aria-hidden />
                    </IconActionButton>
                  </>
                ) : null}
                <IconActionButton
                  title="Edit"
                  tone="edit"
                  onClick={() => navigate(path.rules.details(rule.id))}
                >
                  <LuPencil className="size-4" strokeWidth={1.75} aria-hidden />
                </IconActionButton>
                <IconActionButton title="Apply" onClick={() => onApplyRule(rule)}>
                  <LuPlay className="size-4" strokeWidth={1.75} aria-hidden />
                </IconActionButton>
                <ConfirmDeleteButton
                  variant="icon"
                  title="Delete"
                  confirmMessage="Delete this rule?"
                  onDelete={() => onDeleteRule(rule)}
                />
              </li>
            ))
          )}
        </ul>
      ) : null}
    </section>
  );
}
