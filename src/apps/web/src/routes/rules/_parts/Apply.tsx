import { PrimaryButton, SecondaryButton } from "@web/components/Button";
import { FormErrorSummary } from "@web/components/Fields/FormErrorSummary";
import { FormRow } from "@web/components/Fields/FormRow";
import { IsoDatePickerField } from "@web/components/Fields/IsoDatePickerField";
import { useNotifications } from "@web/contexts/Notifications/Context";
import { StackedModalShell } from "@web/contexts/Settings/components/StackedModalShell";
import { path } from "@web/router/routes";
import { readAccounts } from "@web/utils/api/routes/accounts";
import { fetchCategories } from "@web/utils/api/routes/categories";
import type { CategoryApi } from "@web/utils/api/routes/categories/types";
import { invalidateJobs } from "@web/utils/api/routes/jobs";
import { applyRuleGroup } from "@web/utils/api/routes/rule-groups";
import { applyRule } from "@web/utils/api/routes/rules";
import type { ApplyRulesBody } from "@web/utils/api/routes/rules/types";
import { fetchTags } from "@web/utils/api/routes/tags";
import type { TagApi } from "@web/utils/api/routes/tags/types";
import { fetchSystemAccounts } from "@web/utils/api/routes/transactions";
import { ApiError } from "@web/utils/api/types";
import { errorMessage } from "@web/utils/errors";
import { waitForJob } from "@web/utils/jobs";
import { type SubmitEvent, useEffect, useState } from "react";

export type RuleApplyTarget = {
  type: "rule" | "group";
  id: string;
  title: string;
};

type RuleApplyModalProps = {
  isOpen: boolean;
  target: RuleApplyTarget | null;
  onClose: () => void;
};

function formatRulesJobMessage(
  job: Awaited<ReturnType<typeof waitForJob>>,
  jobPath: string
): string {
  const rules = job.output.rules;
  if (!rules) {
    return `Job finished (${job.status}). ${jobPath}`;
  }
  const prefix = rules.dryRun ? "Dry run: " : "";
  return `${prefix}matched ${rules.matched}, mutated ${rules.mutated}, deleted ${rules.deleted}, skipped ${rules.skipped}. Job: ${jobPath}`;
}

type ApplyFormState = {
  from: string;
  to: string;
  accountId: string;
  word: string;
  categoryId: string;
  subcategoryId: string;
  tagId: string;
  dryRun: boolean;
};

function buildApplyRulesBody(form: ApplyFormState): ApplyRulesBody {
  const body: ApplyRulesBody = { dryRun: form.dryRun };
  const from = form.from.trim();
  const to = form.to.trim();
  const word = form.word.trim();
  if (from) {
    body.from = from;
  }
  if (to) {
    body.to = to;
  }
  if (form.accountId) {
    body.accountId = form.accountId;
  }
  if (word) {
    body.word = word;
  }
  if (form.categoryId) {
    body.categoryId = form.categoryId;
  }
  if (form.subcategoryId) {
    body.subcategoryId = form.subcategoryId;
  }
  if (form.tagId) {
    body.tagId = form.tagId;
  }
  return body;
}

function notifyApplyJobResult(
  job: Awaited<ReturnType<typeof waitForJob>>,
  pushNotification: (message: string, variant: "success" | "error" | "warning") => void,
  onClose: () => void
): void {
  const jobPath = path.jobs.details(job.id);
  if (job.status === "completed") {
    pushNotification(formatRulesJobMessage(job, jobPath), "success");
    onClose();
    return;
  }
  pushNotification(job.error ?? `Apply job ${job.status}. ${jobPath}`, "error");
}

export function Apply({ isOpen, target, onClose }: RuleApplyModalProps) {
  const { pushNotification } = useNotifications();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [accountId, setAccountId] = useState("");
  const [word, setWord] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [tagId, setTagId] = useState("");
  const [dryRun, setDryRun] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [accountOptions, setAccountOptions] = useState<{ id: string; label: string }[]>([]);
  const [categories, setCategories] = useState<CategoryApi[]>([]);
  const [tags, setTags] = useState<TagApi[]>([]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setFrom("");
    setTo("");
    setAccountId("");
    setWord("");
    setCategoryId("");
    setSubcategoryId("");
    setTagId("");
    setDryRun(false);
    setWaiting(false);
    setErrorMessages([]);

    void Promise.all([
      readAccounts({ status: "all" }),
      fetchSystemAccounts(),
      fetchCategories({ limit: 200 }),
      fetchTags({ limit: 200 }),
    ]).then(([accounts, systemAccounts, categoryResponse, tagResponse]) => {
      const instrumentOptions = accounts.accounts.map((account) => ({
        id: account.id,
        label: account.label,
      }));
      const systemOptions = systemAccounts.map((account) => ({
        id: account.id,
        label: account.label,
      }));
      setAccountOptions([...instrumentOptions, ...systemOptions]);
      setCategories(categoryResponse.items);
      setTags(tagResponse.items);
    });
  }, [isOpen]);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!target) {
      return;
    }

    const body = buildApplyRulesBody({
      from,
      to,
      accountId,
      word,
      categoryId,
      subcategoryId,
      tagId,
      dryRun,
    });

    setWaiting(true);
    setErrorMessages([]);
    try {
      const started =
        target.type === "rule"
          ? await applyRule(target.id, body)
          : await applyRuleGroup(target.id, body);
      invalidateJobs();
      const job = await waitForJob(started.jobId);
      notifyApplyJobResult(job, pushNotification, onClose);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        pushNotification("A rules apply job is already running.", "warning");
      } else {
        setErrorMessages([errorMessage(error, "Could not apply rules")]);
      }
    } finally {
      setWaiting(false);
    }
  }

  const modalTitle = target ? `Apply Rules — ${target.title}` : "Apply Rules";

  return (
    <StackedModalShell isOpen={isOpen} title={modalTitle} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormErrorSummary messages={errorMessages} />
        <p className="text-sm text-slate-600">
          Optional filters limit which ledger rows are scanned. Leave fields empty to consider all
          transactions.
        </p>
        <FormRow label="From Date">
          <IsoDatePickerField value={from} onChange={setFrom} isClearable />
        </FormRow>
        <FormRow label="To Date">
          <IsoDatePickerField value={to} onChange={setTo} isClearable />
        </FormRow>
        <FormRow label="Account">
          <select
            className="form-input w-full"
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
          >
            <option value="">Any</option>
            {accountOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Description Contains">
          <input
            type="text"
            className="form-input w-full"
            value={word}
            onChange={(event) => setWord(event.target.value)}
          />
        </FormRow>
        <FormRow label="Category">
          <select
            className="form-input w-full"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">Any</option>
            {categories
              .filter((category) => category.parentId === null)
              .map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
          </select>
        </FormRow>
        <FormRow label="Subcategory">
          <select
            className="form-input w-full"
            value={subcategoryId}
            onChange={(event) => setSubcategoryId(event.target.value)}
          >
            <option value="">Any</option>
            {categories
              .filter((category) => category.parentId !== null)
              .map((sub) => {
                const parent = categories.find((row) => row.id === sub.parentId);
                return (
                  <option key={sub.id} value={sub.id}>
                    {parent ? `${parent.name} / ${sub.name}` : sub.name}
                  </option>
                );
              })}
          </select>
        </FormRow>
        <FormRow label="Tag">
          <select
            className="form-input w-full"
            value={tagId}
            onChange={(event) => setTagId(event.target.value)}
          >
            <option value="">Any</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
        </FormRow>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(event) => setDryRun(event.target.checked)}
            disabled={waiting}
          />
          Dry run (no ledger changes)
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <SecondaryButton type="button" onClick={onClose} disabled={waiting}>
            Cancel
          </SecondaryButton>
          <PrimaryButton type="submit" disabled={waiting || !target}>
            {waiting ? "Applying…" : "Apply"}
          </PrimaryButton>
        </div>
      </form>
    </StackedModalShell>
  );
}
