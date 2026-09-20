import { formatInstrumentAccountPickerLabel } from "@ndb/platform";
import { PrimaryButton, SecondaryButton } from "@web/components/Button";
import { FormErrorSummary } from "@web/components/Fields/FormErrorSummary";
import { FormRow } from "@web/components/Fields/FormRow";
import { PageTitle } from "@web/components/Layout/PageTitle";
import { useCreditCardCatalogTitles } from "@web/hooks/credit-card-titles";
import { path } from "@web/router/path";
import { Apply } from "@web/routes/rules/_parts/Apply";
import { Test } from "@web/routes/rules/_parts/Test";
import {
  formatRuleWhen,
  parseRuleText,
  type RuleExpression,
  type RuleTextCatalogs,
} from "@web/routes/rules/_parts/text";
import { Action, actionIsComplete } from "@web/routes/rules/editor/_parts/Action";
import { When } from "@web/routes/rules/editor/_parts/When";
import { readAccounts } from "@web/utils/api/routes/accounts";
import type { Account } from "@web/utils/api/routes/accounts/types";
import { fetchCategories } from "@web/utils/api/routes/categories";
import type { CategoryApi } from "@web/utils/api/routes/categories/types";
import { fetchRuleGroups } from "@web/utils/api/routes/rule-groups";
import { createRule, fetchRule, patchRule } from "@web/utils/api/routes/rules";
import type { CatalogItem } from "@web/utils/api/routes/rules/types";
import { fetchTags } from "@web/utils/api/routes/tags";
import type { TagApi } from "@web/utils/api/routes/tags/types";
import { fetchSystemAccounts } from "@web/utils/api/routes/transactions";
import { errorMessage } from "@web/utils/errors";
import { type SubmitEvent, useEffect, useMemo, useState } from "react";
import { FaArrowLeft } from "react-icons/fa";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

function asExpression(value: unknown): RuleExpression | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as RuleExpression;
}

type EditorCatalogSources = {
  accounts: { accounts: { id: string; label: string }[] };
  systemAccounts: { id: string; label: string }[];
  categories: CategoryApi[];
  tags: TagApi[];
};

type LoadedRuleFields = {
  title: string;
  description: string;
  runOnCreate: boolean;
  stopProcessing: boolean;
  actions: CatalogItem[];
  groupId: string;
  whenText: string;
  groupTitle: string;
};

function catalogsFromSources(sources: EditorCatalogSources): RuleTextCatalogs {
  return {
    accounts: [
      ...sources.accounts.accounts.map((account) => ({ id: account.id, label: account.label })),
      ...sources.systemAccounts.map((account) => ({ id: account.id, label: account.label })),
    ],
    categories: sources.categories.map((category) => ({
      id: category.id,
      name: category.name,
      parentId: category.parentId,
    })),
    tags: sources.tags.map((tag) => ({ id: tag.id, name: tag.name })),
  };
}

function groupTitleById(groups: { id: string; title: string }[], groupId: string): string {
  return groups.find((group) => group.id === groupId)?.title ?? "";
}

async function loadExistingRule(
  ruleId: string,
  groups: { id: string; title: string }[],
  catalogs: RuleTextCatalogs
): Promise<LoadedRuleFields> {
  const rule = await fetchRule(ruleId);
  const expression = asExpression(rule.when);
  return {
    title: rule.title,
    description: rule.description ?? "",
    runOnCreate: rule.runOnCreate,
    stopProcessing: rule.stopProcessing,
    actions: rule.actions,
    groupId: rule.groupId,
    whenText: expression ? formatRuleWhen(expression, catalogs) : "",
    groupTitle: groupTitleById(groups, rule.groupId),
  };
}

async function loadRuleEditor(ruleId: string | undefined, groupIdFromQuery: string | null) {
  const [accounts, systemAccounts, categoryResponse, tagResponse, groups] = await Promise.all([
    readAccounts({ status: "all" }),
    fetchSystemAccounts(),
    fetchCategories({ limit: 200 }),
    fetchTags({ limit: 200 }),
    fetchRuleGroups({ limit: 200 }),
  ]);
  const catalogs = catalogsFromSources({
    accounts,
    systemAccounts,
    categories: categoryResponse.items,
    tags: tagResponse.items,
  });
  const existing = ruleId ? await loadExistingRule(ruleId, groups.items, catalogs) : null;
  const groupTitle = existing
    ? existing.groupTitle
    : groupIdFromQuery
      ? groupTitleById(groups.items, groupIdFromQuery)
      : "";
  return {
    catalogs,
    categories: categoryResponse.items,
    tags: tagResponse.items,
    instrumentAccounts: accounts.accounts,
    systemAccountOptions: systemAccounts.map((account) => ({
      id: account.id,
      label: account.label,
    })),
    existing,
    groupTitle,
  };
}

export function Content() {
  const { ruleId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const groupIdFromQuery = searchParams.get("groupId");
  const isEdit = Boolean(ruleId);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [whenText, setWhenText] = useState("");
  const [whenError, setWhenError] = useState<string | null>(null);
  const [actions, setActions] = useState<CatalogItem[]>([]);
  const [runOnCreate, setRunOnCreate] = useState(true);
  const [stopProcessing, setStopProcessing] = useState(false);
  const [groupId, setGroupId] = useState(groupIdFromQuery ?? "");
  const [groupTitle, setGroupTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const missingGroup = !isEdit && !groupIdFromQuery;
  const [submitting, setSubmitting] = useState(false);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [applyOpen, setApplyOpen] = useState(false);
  const [catalogs, setCatalogs] = useState<RuleTextCatalogs>({
    accounts: [],
    categories: [],
    tags: [],
  });
  const [categories, setCategories] = useState<CategoryApi[]>([]);
  const [tags, setTags] = useState<TagApi[]>([]);
  const [instrumentAccounts, setInstrumentAccounts] = useState<Account[]>([]);
  const [systemAccountOptions, setSystemAccountOptions] = useState<{ id: string; label: string }[]>(
    []
  );
  const catalogTitles = useCreditCardCatalogTitles();
  const accountOptions = useMemo(
    () => [
      ...instrumentAccounts.map((account) => ({
        id: account.id,
        label: formatInstrumentAccountPickerLabel(account, catalogTitles),
      })),
      ...systemAccountOptions,
    ],
    [instrumentAccounts, systemAccountOptions, catalogTitles]
  );

  useEffect(() => {
    let cancelled = false;
    void loadRuleEditor(ruleId, groupIdFromQuery)
      .then((loaded) => {
        if (cancelled) {
          return;
        }
        setCatalogs(loaded.catalogs);
        setCategories(loaded.categories);
        setTags(loaded.tags);
        setInstrumentAccounts(loaded.instrumentAccounts);
        setSystemAccountOptions(loaded.systemAccountOptions);
        setGroupTitle(loaded.groupTitle);
        if (!loaded.existing) {
          return;
        }
        setTitle(loaded.existing.title);
        setDescription(loaded.existing.description);
        setRunOnCreate(loaded.existing.runOnCreate);
        setStopProcessing(loaded.existing.stopProcessing);
        setActions(loaded.existing.actions);
        setGroupId(loaded.existing.groupId);
        setWhenText(loaded.existing.whenText);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setErrorMessages([errorMessage(err, "Could not load rule")]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ruleId, groupIdFromQuery]);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = title.trim();
    const messages: string[] = [];
    if (!trimmed) {
      messages.push("Name is required.");
    }
    const parsed = parseRuleText(whenText, catalogs);
    if (!parsed.ok) {
      setWhenError(parsed.error);
      messages.push(parsed.error);
    } else {
      setWhenError(null);
    }
    if (actions.length === 0) {
      messages.push("Add at least one action.");
    } else if (actions.some((action) => !actionIsComplete(action))) {
      messages.push("Finish each action before saving.");
    }
    if (messages.length > 0 || !parsed.ok) {
      setErrorMessages(messages);
      return;
    }
    setSubmitting(true);
    setErrorMessages([]);
    try {
      const descriptionValue = description.trim() ? description.trim() : null;
      if (ruleId) {
        await patchRule(ruleId, {
          title: trimmed,
          description: descriptionValue,
          runOnCreate,
          stopProcessing,
          when: parsed.when,
          actions,
        });
      } else {
        await createRule({
          groupId,
          title: trimmed,
          description: descriptionValue,
          runOnCreate,
          stopProcessing,
          when: parsed.when,
          actions,
        });
      }
      navigate(path.rules.list);
    } catch (err: unknown) {
      setErrorMessages([errorMessage(err, "Could not save rule")]);
    } finally {
      setSubmitting(false);
    }
  }

  if (missingGroup) {
    return (
      <div className="mx-auto w-full max-w-6xl">
        <PageTitle page="New Rule" />
        <p className="text-sm text-slate-600">Missing rule group.</p>
      </div>
    );
  }

  return (
    <RuleEditorForm
      isEdit={isEdit}
      title={title}
      groupTitle={groupTitle}
      loading={loading}
      onSubmit={handleSubmit}
      errorMessages={errorMessages}
      onTitleChange={setTitle}
      description={description}
      onDescriptionChange={setDescription}
      whenText={whenText}
      onWhenTextChange={setWhenText}
      whenError={whenError}
      actions={actions}
      onActionsChange={setActions}
      categories={categories}
      tags={tags}
      accountOptions={accountOptions}
      runOnCreate={runOnCreate}
      onRunOnCreateChange={setRunOnCreate}
      stopProcessing={stopProcessing}
      onStopProcessingChange={setStopProcessing}
      submitting={submitting}
      onCancel={() => navigate(path.rules.list)}
      ruleId={ruleId}
      onApply={() => setApplyOpen(true)}
      applyOpen={applyOpen}
      onApplyClose={() => setApplyOpen(false)}
    />
  );
}

function RuleEditorForm({
  isEdit,
  title,
  groupTitle,
  loading,
  onSubmit,
  errorMessages,
  onTitleChange,
  description,
  onDescriptionChange,
  whenText,
  onWhenTextChange,
  whenError,
  actions,
  onActionsChange,
  categories,
  tags,
  accountOptions,
  runOnCreate,
  onRunOnCreateChange,
  stopProcessing,
  onStopProcessingChange,
  submitting,
  onCancel,
  ruleId,
  onApply,
  applyOpen,
  onApplyClose,
}: {
  isEdit: boolean;
  title: string;
  groupTitle: string;
  loading: boolean;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  errorMessages: string[];
  onTitleChange: (title: string) => void;
  description: string;
  onDescriptionChange: (description: string) => void;
  whenText: string;
  onWhenTextChange: (value: string) => void;
  whenError: string | null;
  actions: CatalogItem[];
  onActionsChange: (actions: CatalogItem[]) => void;
  categories: CategoryApi[];
  tags: TagApi[];
  accountOptions: { id: string; label: string }[];
  runOnCreate: boolean;
  onRunOnCreateChange: (value: boolean) => void;
  stopProcessing: boolean;
  onStopProcessingChange: (value: boolean) => void;
  submitting: boolean;
  onCancel: () => void;
  ruleId: string | undefined;
  onApply: () => void;
  applyOpen: boolean;
  onApplyClose: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageTitle page={isEdit ? "Edit Rule" : "New Rule"} />
      <Link
        to={path.rules.list}
        className="mb-4 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
      >
        <FaArrowLeft className="size-3" aria-hidden />
        Rules
      </Link>
      <h1 className="text-xl font-semibold text-slate-900">
        {isEdit ? title || "Edit rule" : "New rule"}
      </h1>
      {groupTitle ? <p className="mt-1 text-sm text-slate-500">{groupTitle}</p> : null}
      {loading ? <p className="mt-6 text-sm text-slate-500">Loading…</p> : null}
      {!loading ? (
        <form onSubmit={(event) => void onSubmit(event)} className="mt-6 space-y-6">
          <FormErrorSummary messages={errorMessages} />
          <FormRow label="Name">
            <input
              type="text"
              className="form-input w-full"
              value={title}
              maxLength={128}
              onChange={(event) => onTitleChange(event.target.value)}
            />
          </FormRow>
          <FormRow label="Note">
            <textarea
              className="form-input min-h-16 w-full"
              value={description}
              maxLength={2048}
              onChange={(event) => onDescriptionChange(event.target.value)}
            />
          </FormRow>
          <When value={whenText} onChange={onWhenTextChange} error={whenError} />
          <Action
            actions={actions}
            onChange={onActionsChange}
            categories={categories}
            tags={tags}
            accountOptions={accountOptions}
          />
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={runOnCreate}
              onChange={(event) => onRunOnCreateChange(event.target.checked)}
            />
            Apply automatically to new transactions
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={stopProcessing}
              onChange={(event) => onStopProcessingChange(event.target.checked)}
            />
            Skip later rules after this one matches
          </label>
          <div className="flex justify-end gap-2">
            <SecondaryButton type="button" onClick={onCancel} disabled={submitting}>
              Cancel
            </SecondaryButton>
            {ruleId ? (
              <SecondaryButton type="button" onClick={onApply}>
                Apply
              </SecondaryButton>
            ) : null}
            <PrimaryButton type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save"}
            </PrimaryButton>
          </div>
          {ruleId ? (
            <details className="rounded-md border border-slate-200 p-4">
              <summary className="cursor-pointer text-sm font-medium text-slate-800">
                Try a sample
              </summary>
              <div className="mt-4">
                <Test ruleId={ruleId} accountOptions={accountOptions} />
              </div>
            </details>
          ) : (
            <p className="text-sm text-slate-500">Save the rule to try a sample.</p>
          )}
        </form>
      ) : null}
      {ruleId ? (
        <Apply
          isOpen={applyOpen}
          target={{ type: "rule", id: ruleId, title }}
          onClose={onApplyClose}
        />
      ) : null}
    </div>
  );
}
