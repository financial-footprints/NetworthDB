import { PrimaryButton, SecondaryButton } from "@web/components/Button";
import { FormErrorSummary } from "@web/components/Fields/FormErrorSummary";
import { IsoDatePickerField } from "@web/components/Fields/IsoDatePickerField";
import { Dialog } from "@web/components/Modal/Dialog";
import { Hover } from "@web/components/Popover/Hover";
import { BulkEditTagsCell } from "@web/routes/accounts/details/_parts/ledger/BulkEditTagsCell";
import { BulkStampPanel } from "@web/routes/accounts/details/_parts/ledger/BulkStampPanel";
import {
  BULK_TRANSACTION_LIMIT,
  loadMatchingTransactions,
} from "@web/routes/accounts/details/_parts/ledger/helpers";
import type { LedgerApiFilterParams } from "@web/routes/accounts/details/_parts/ledger/query";
import type {
  LedgerFormState,
  PickerOption,
} from "@web/routes/accounts/details/_parts/ledger/TransactionFormFields";
import type { CategoryApi } from "@web/utils/api/routes/categories/types";
import type { TagApi } from "@web/utils/api/routes/tags/types";
import { bulkUpdateTransactions } from "@web/utils/api/routes/transactions";
import type {
  TransactionApi,
  UpdateTransactionBody,
} from "@web/utils/api/routes/transactions/types";
import { DEFAULT_LIST_PAGE_SIZE } from "@web/utils/constants";
import { errorMessage } from "@web/utils/errors";
import { formatIntegerAsRupee, parseRupeeToInteger } from "@web/utils/money";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";

const BULK_EDIT_LIMIT = BULK_TRANSACTION_LIMIT;
const MAX_TAGS_PER_TRANSACTION = 20;
const NO_CHANGE = "__no_change";

export type BulkSelection =
  | { kind: "rows"; rows: TransactionApi[] }
  | { kind: "filtered"; total: number; query: LedgerApiFilterParams };

type BulkDraft = {
  id: string;
  original: LedgerFormState;
  form: LedgerFormState;
};

type BulkModalProps = {
  open: boolean;
  onClose: () => void;
  accountId: string;
  selection: BulkSelection | null;
  partyOptions: PickerOption[];
  rootCategories: CategoryApi[];
  subcategoriesForCategory: (categoryId: string) => CategoryApi[];
  allTags: TagApi[];
  onSaved: () => void;
};

function transactionToForm(row: TransactionApi): LedgerFormState {
  return {
    date: row.date,
    amount: formatIntegerAsRupee(row.amount),
    description: row.description,
    ref: row.refNo ?? "",
    sourceAccountId: row.source.id,
    destinationAccountId: row.destination.id,
    categoryId: row.category?.id ?? "",
    subcategoryId: row.subcategory?.id ?? "",
    tagIds: row.tags.map((tag) => tag.id),
  };
}

function formToPayload(form: LedgerFormState): UpdateTransactionBody | null {
  const trimmedDescription = form.description.trim();
  if (!trimmedDescription || !form.sourceAccountId || !form.destinationAccountId) {
    return null;
  }
  let amount: number;
  try {
    amount = parseRupeeToInteger(form.amount);
  } catch {
    return null;
  }
  if (amount <= 0) {
    return null;
  }
  return {
    date: form.date,
    amount,
    sourceAccountId: form.sourceAccountId,
    destinationAccountId: form.destinationAccountId,
    description: trimmedDescription,
    refNo: form.ref.trim() ? form.ref.trim() : null,
    categoryId: form.categoryId || null,
    subcategoryId: form.subcategoryId || null,
    tagIds: form.tagIds,
  };
}

function samePayload(left: LedgerFormState, right: LedgerFormState): boolean {
  const a = formToPayload(left);
  const b = formToPayload(right);
  if (!a || !b) {
    return JSON.stringify(left) === JSON.stringify(right);
  }
  return (
    a.date === b.date &&
    a.amount === b.amount &&
    a.sourceAccountId === b.sourceAccountId &&
    a.destinationAccountId === b.destinationAccountId &&
    a.description === b.description &&
    a.refNo === b.refNo &&
    a.categoryId === b.categoryId &&
    a.subcategoryId === b.subcategoryId &&
    [...(a.tagIds ?? [])].sort().join(",") === [...(b.tagIds ?? [])].sort().join(",")
  );
}

function rowErrors(form: LedgerFormState): string[] {
  const messages: string[] = [];
  if (!form.description.trim()) {
    messages.push("Description is required.");
  }
  try {
    if (parseRupeeToInteger(form.amount) <= 0) {
      messages.push("Enter a valid amount.");
    }
  } catch {
    messages.push("Enter a valid amount.");
  }
  if (!form.sourceAccountId || !form.destinationAccountId) {
    messages.push("Source and destination accounts are required.");
  } else if (form.sourceAccountId === form.destinationAccountId) {
    messages.push("Source and destination must be different accounts.");
  }
  if (form.tagIds.length > MAX_TAGS_PER_TRANSACTION) {
    messages.push(`A transaction can have at most ${MAX_TAGS_PER_TRANSACTION} tags.`);
  }
  return messages;
}

function withOptions(options: PickerOption[], selectedId: string): PickerOption[] {
  if (!selectedId || options.some((option) => option.id === selectedId)) {
    return options;
  }
  return [...options, { id: selectedId, label: "Selected account" }];
}

function pickerLabel(options: PickerOption[], selectedId: string): string {
  return withOptions(options, selectedId).find((option) => option.id === selectedId)?.label ?? "";
}

function rowsToDrafts(rows: TransactionApi[]): BulkDraft[] {
  return rows.map((row) => {
    const form = transactionToForm(row);
    return { id: row.id, original: form, form };
  });
}

function resolveBulkSubcategoryParent(applyCategory: string, drafts: BulkDraft[]): string | null {
  if (applyCategory !== NO_CHANGE) {
    return applyCategory;
  }
  const ids = new Set(drafts.map((draft) => draft.form.categoryId));
  if (ids.size === 1) {
    return [...ids][0] ?? "";
  }
  return null;
}

type BulkSavePlan =
  | { kind: "no_changes" }
  | {
      kind: "validation_failed";
      messages: string[];
      rowErrorIds: string[];
      page: number;
    }
  | { kind: "ready"; items: Array<{ id: string } & UpdateTransactionBody> };

function planBulkSave(drafts: BulkDraft[]): BulkSavePlan {
  const changed = drafts.filter((draft) => !samePayload(draft.original, draft.form));
  if (changed.length === 0) {
    return { kind: "no_changes" };
  }
  const invalid = changed.filter((draft) => rowErrors(draft.form).length > 0);
  if (invalid.length > 0) {
    const firstIndex = drafts.findIndex((draft) => draft.id === invalid[0]?.id);
    return {
      kind: "validation_failed",
      messages: invalid
        .slice(0, 3)
        .flatMap((draft) => rowErrors(draft.form).map((message) => message)),
      rowErrorIds: invalid.map((draft) => draft.id),
      page: firstIndex >= 0 ? Math.floor(firstIndex / DEFAULT_LIST_PAGE_SIZE) : 0,
    };
  }
  const items = changed.flatMap((draft) => {
    const body = formToPayload(draft.form);
    return body ? [{ id: draft.id, ...body }] : [];
  });
  return { kind: "ready", items };
}

function useBulkModalDrafts(
  open: boolean,
  selection: BulkSelection | null,
  accountId: string,
  onSelectionActivated: () => void
) {
  const [drafts, setDrafts] = useState<BulkDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tooMany, setTooMany] = useState(false);

  useEffect(() => {
    if (!open || !selection) {
      return;
    }
    onSelectionActivated();

    if (selection.kind === "rows") {
      setTooMany(false);
      setLoadError(null);
      setLoading(false);
      setDrafts(rowsToDrafts(selection.rows));
      return;
    }

    if (selection.total > BULK_EDIT_LIMIT) {
      setTooMany(true);
      setDrafts([]);
      setLoading(false);
      setLoadError(null);
      return;
    }

    const controller = new AbortController();
    setTooMany(false);
    setLoading(true);
    setLoadError(null);
    setDrafts([]);
    void loadMatchingTransactions(accountId, selection.query)
      .then((rows) => {
        if (controller.signal.aborted) {
          return;
        }
        if (rows.length > BULK_EDIT_LIMIT) {
          setTooMany(true);
          return;
        }
        setDrafts(rowsToDrafts(rows));
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setLoadError(errorMessage(err, "Could not load transactions"));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [accountId, onSelectionActivated, open, selection]);

  return { drafts, setDrafts, loading, loadError, tooMany };
}

type BulkStampInput = {
  noChangeValue: string;
  applySource: string;
  applyDestination: string;
  applyDate: string;
  applyAmount: string;
  applyDescription: string;
  applyRef: string;
  applyCategory: string;
  applySubcategory: string;
};

function buildBulkStampPatch(
  input: BulkStampInput
): { patch: Partial<LedgerFormState> } | { error: string } | null {
  const patch: Partial<LedgerFormState> = {};
  const noChange = input.noChangeValue;

  if (input.applySource !== noChange) {
    patch.sourceAccountId = input.applySource;
  }
  if (input.applyDestination !== noChange) {
    patch.destinationAccountId = input.applyDestination;
  }
  if (input.applyDate.trim()) {
    patch.date = input.applyDate.trim();
  }
  if (input.applyAmount.trim()) {
    try {
      const amount = parseRupeeToInteger(input.applyAmount.trim());
      if (amount <= 0) {
        return { error: "Enter a valid amount." };
      }
      patch.amount = formatIntegerAsRupee(amount);
    } catch {
      return { error: "Enter a valid amount." };
    }
  }
  if (input.applyDescription.trim()) {
    patch.description = input.applyDescription.trim();
  }
  if (input.applyRef.trim()) {
    patch.ref = input.applyRef.trim();
  }
  if (input.applyCategory !== noChange) {
    patch.categoryId = input.applyCategory;
    patch.subcategoryId = "";
  }
  if (input.applySubcategory !== noChange) {
    patch.subcategoryId = input.applySubcategory;
  }

  if (Object.keys(patch).length === 0) {
    return null;
  }
  return { patch };
}

function mergeBulkTagSelection(
  setDrafts: Dispatch<SetStateAction<BulkDraft[]>>,
  stamp: (patch: Partial<LedgerFormState>) => void,
  applyTags: string[],
  tagMode: "add" | "replace"
) {
  if (applyTags.length === 0) {
    return;
  }
  if (tagMode === "replace") {
    stamp({ tagIds: applyTags });
    return;
  }
  setDrafts((current) =>
    current.map((draft) => ({
      ...draft,
      form: {
        ...draft.form,
        tagIds: [...new Set([...draft.form.tagIds, ...applyTags])],
      },
    }))
  );
}

export function BulkModal({
  open,
  onClose,
  accountId,
  selection,
  partyOptions,
  rootCategories,
  subcategoriesForCategory,
  allTags,
  onSaved,
}: BulkModalProps) {
  const [page, setPage] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [rowErrorIds, setRowErrorIds] = useState<string[]>([]);
  const [applySource, setApplySource] = useState(NO_CHANGE);
  const [applyDestination, setApplyDestination] = useState(NO_CHANGE);
  const [applyDate, setApplyDate] = useState("");
  const [applyDescription, setApplyDescription] = useState("");
  const [applyAmount, setApplyAmount] = useState("");
  const [applyRef, setApplyRef] = useState("");
  const [applyCategory, setApplyCategory] = useState(NO_CHANGE);
  const [applySubcategory, setApplySubcategory] = useState(NO_CHANGE);
  const [applyTags, setApplyTags] = useState<string[]>([]);
  const [tagMode, setTagMode] = useState<"add" | "replace">("add");
  const [stampFormError, setStampFormError] = useState<string | null>(null);
  const sourceAccountIdField = useId();
  const destinationAccountIdField = useId();
  const bulkDateId = useId();
  const bulkAmountId = useId();
  const bulkDescriptionId = useId();
  const bulkRefId = useId();
  const bulkCategoryId = useId();
  const bulkSubcategoryId = useId();

  const resetStampForm = useCallback(() => {
    setApplySource(NO_CHANGE);
    setApplyDestination(NO_CHANGE);
    setApplyDate("");
    setApplyDescription("");
    setApplyAmount("");
    setApplyRef("");
    setApplyCategory(NO_CHANGE);
    setApplySubcategory(NO_CHANGE);
    setApplyTags([]);
    setTagMode("add");
    setStampFormError(null);
  }, []);

  const onSelectionActivated = useCallback(() => {
    setPage(0);
    setErrorMessages([]);
    setRowErrorIds([]);
    resetStampForm();
    setSubmitting(false);
  }, [resetStampForm]);

  const { drafts, setDrafts, loading, loadError, tooMany } = useBulkModalDrafts(
    open,
    selection,
    accountId,
    onSelectionActivated
  );

  const subcategoryParent = useMemo(
    () => resolveBulkSubcategoryParent(applyCategory, drafts),
    [applyCategory, drafts]
  );

  function stamp(patch: Partial<LedgerFormState>) {
    setDrafts((current) =>
      current.map((draft) => ({ ...draft, form: { ...draft.form, ...patch } }))
    );
  }

  const stampInput = useMemo(
    (): BulkStampInput => ({
      noChangeValue: NO_CHANGE,
      applySource,
      applyDestination,
      applyDate,
      applyAmount,
      applyDescription,
      applyRef,
      applyCategory,
      applySubcategory,
    }),
    [
      applySource,
      applyDestination,
      applyDate,
      applyAmount,
      applyDescription,
      applyRef,
      applyCategory,
      applySubcategory,
    ]
  );

  const canApplyStampToAll = useMemo(() => {
    const result = buildBulkStampPatch(stampInput);
    return result !== null && "patch" in result;
  }, [stampInput]);

  function applyStampToAll() {
    const result = buildBulkStampPatch(stampInput);
    if (result === null) {
      return;
    }
    if ("error" in result) {
      setStampFormError(result.error);
      return;
    }
    setStampFormError(null);
    stamp(result.patch);
  }

  function updateDraft(id: string, patch: Partial<LedgerFormState>) {
    setDrafts((current) =>
      current.map((draft) =>
        draft.id === id ? { ...draft, form: { ...draft.form, ...patch } } : draft
      )
    );
  }

  async function handleSave() {
    const plan = planBulkSave(drafts);
    if (plan.kind === "no_changes") {
      setErrorMessages(["No changes to save."]);
      setRowErrorIds([]);
      return;
    }
    if (plan.kind === "validation_failed") {
      setRowErrorIds(plan.rowErrorIds);
      setErrorMessages(plan.messages);
      setPage(plan.page);
      return;
    }

    setSubmitting(true);
    setErrorMessages([]);
    setRowErrorIds([]);
    try {
      await bulkUpdateTransactions(accountId, plan.items);
      onSaved();
      onClose();
    } catch (err: unknown) {
      setErrorMessages([errorMessage(err, "Could not update transactions")]);
    } finally {
      setSubmitting(false);
    }
  }

  const overLimit =
    tooMany || (selection?.kind === "filtered" && selection.total > BULK_EDIT_LIMIT);
  const selectedTotal =
    selection?.kind === "filtered" ? selection.total : (selection?.rows.length ?? 0);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <>
          {`Edit ${selectedTotal.toLocaleString()} Transactions`}
          <Hover ariaLabel="How bulk apply works">
            Set values in the form below, then choose{" "}
            <span className="font-medium">Apply To All Rows</span> to copy them onto every selected
            transaction. You can still edit individual rows in the table. Tag changes use the
            separate tags section.
          </Hover>
        </>
      }
      panelClassName="relative w-full max-w-[calc(100vw-2rem)] rounded-sm bg-white p-5 shadow-xl max-h-[95vh] overflow-y-auto"
      busy={submitting || loading}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </SecondaryButton>
          <PrimaryButton
            type="button"
            onClick={() => void handleSave()}
            disabled={submitting || loading || overLimit || drafts.length === 0}
          >
            Save
          </PrimaryButton>
        </>
      }
    >
      <BulkModalBody
        overLimit={overLimit}
        loading={loading}
        loadError={loadError}
        drafts={drafts}
        page={page}
        setPage={setPage}
        errorMessages={errorMessages}
        rowErrorIds={rowErrorIds}
        partyOptions={partyOptions}
        rootCategories={rootCategories}
        subcategoriesForCategory={subcategoriesForCategory}
        allTags={allTags}
        stampPanel={
          <BulkStampPanel
            noChangeValue={NO_CHANGE}
            partyOptions={partyOptions}
            rootCategories={rootCategories}
            subcategoriesForCategory={subcategoriesForCategory}
            subcategoryParent={subcategoryParent}
            allTags={allTags}
            applySource={applySource}
            setApplySource={setApplySource}
            applyDestination={applyDestination}
            setApplyDestination={setApplyDestination}
            applyDate={applyDate}
            setApplyDate={setApplyDate}
            applyAmount={applyAmount}
            setApplyAmount={setApplyAmount}
            applyDescription={applyDescription}
            setApplyDescription={setApplyDescription}
            applyRef={applyRef}
            setApplyRef={setApplyRef}
            applyCategory={applyCategory}
            setApplyCategory={setApplyCategory}
            applySubcategory={applySubcategory}
            setApplySubcategory={setApplySubcategory}
            applyTags={applyTags}
            setApplyTags={setApplyTags}
            tagMode={tagMode}
            setTagMode={setTagMode}
            sourceAccountIdField={sourceAccountIdField}
            destinationAccountIdField={destinationAccountIdField}
            bulkDateId={bulkDateId}
            bulkAmountId={bulkAmountId}
            bulkDescriptionId={bulkDescriptionId}
            bulkRefId={bulkRefId}
            bulkCategoryId={bulkCategoryId}
            bulkSubcategoryId={bulkSubcategoryId}
            canApplyToAll={canApplyStampToAll}
            stampFormError={stampFormError}
            onApplyToAll={applyStampToAll}
            onResetForm={resetStampForm}
            onApplyTags={() => mergeBulkTagSelection(setDrafts, stamp, applyTags, tagMode)}
            onClearTagsOnAllRows={() => {
              setApplyTags([]);
              stamp({ tagIds: [] });
            }}
          />
        }
        updateDraft={updateDraft}
      />
    </Dialog>
  );
}

type BulkModalBodyProps = {
  overLimit: boolean;
  loading: boolean;
  loadError: string | null;
  drafts: BulkDraft[];
  page: number;
  setPage: Dispatch<SetStateAction<number>>;
  errorMessages: string[];
  rowErrorIds: string[];
  partyOptions: PickerOption[];
  rootCategories: CategoryApi[];
  subcategoriesForCategory: (categoryId: string) => CategoryApi[];
  allTags: TagApi[];
  stampPanel: ReactNode;
  updateDraft: (id: string, patch: Partial<LedgerFormState>) => void;
};

function BulkModalBody({
  overLimit,
  loading,
  loadError,
  drafts,
  page,
  setPage,
  errorMessages,
  rowErrorIds,
  partyOptions,
  rootCategories,
  subcategoriesForCategory,
  allTags,
  stampPanel,
  updateDraft,
}: BulkModalBodyProps) {
  if (overLimit) {
    return (
      <p className="text-sm text-slate-700">
        Bulk edit supports up to {BULK_EDIT_LIMIT.toLocaleString()} transactions. Narrow the
        filters, then select them again.
      </p>
    );
  }
  if (loading) {
    return <p className="text-sm text-slate-600">Loading transactions…</p>;
  }
  if (loadError) {
    return <p className="text-sm text-red-600">{loadError}</p>;
  }
  if (drafts.length === 0) {
    return null;
  }

  const pageCount = Math.max(1, Math.ceil(drafts.length / DEFAULT_LIST_PAGE_SIZE));
  const pageRows = drafts.slice(page * DEFAULT_LIST_PAGE_SIZE, (page + 1) * DEFAULT_LIST_PAGE_SIZE);

  return (
    <div className="space-y-4">
      <FormErrorSummary messages={errorMessages} />
      {stampPanel}

      <div className="overflow-x-auto">
        <table className="bulk-edit-table">
          <colgroup>
            <col className="bulk-edit-col-date" />
            <col className="bulk-edit-col-description" />
            <col className="bulk-edit-col-from" />
            <col className="bulk-edit-col-to" />
            <col className="bulk-edit-col-amount" />
            <col className="bulk-edit-col-category" />
            <col className="bulk-edit-col-subcategory" />
            <col className="bulk-edit-col-reference" />
            <col className="bulk-edit-col-tags" />
          </colgroup>
          <thead>
            <tr className="border-b text-slate-500">
              <th className="py-2 pr-2">Date</th>
              <th className="py-2 pr-2">Description</th>
              <th className="py-2 pr-2">From</th>
              <th className="py-2 pr-2">To</th>
              <th className="py-2 pr-2">Amount</th>
              <th className="py-2 pr-2">Category</th>
              <th className="py-2 pr-2">Subcategory</th>
              <th className="py-2 pr-2">Reference</th>
              <th className="py-2">Tags</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((draft) => {
              const invalid = rowErrorIds.includes(draft.id);
              const sourceLabel = pickerLabel(partyOptions, draft.form.sourceAccountId);
              const destinationLabel = pickerLabel(partyOptions, draft.form.destinationAccountId);
              return (
                <tr key={draft.id} className={invalid ? "bg-red-50" : undefined}>
                  <td className="bulk-edit-cell-date py-2 pr-2">
                    <IsoDatePickerField
                      value={draft.form.date}
                      onChange={(iso) => updateDraft(draft.id, { date: iso })}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="text"
                      className="form-input"
                      value={draft.form.description}
                      onChange={(event) =>
                        updateDraft(draft.id, { description: event.target.value })
                      }
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <select
                      className="form-input"
                      value={draft.form.sourceAccountId}
                      title={sourceLabel}
                      onChange={(event) =>
                        updateDraft(draft.id, { sourceAccountId: event.target.value })
                      }
                    >
                      {withOptions(partyOptions, draft.form.sourceAccountId).map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-2">
                    <select
                      className="form-input"
                      value={draft.form.destinationAccountId}
                      title={destinationLabel}
                      onChange={(event) =>
                        updateDraft(draft.id, { destinationAccountId: event.target.value })
                      }
                    >
                      {withOptions(partyOptions, draft.form.destinationAccountId).map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="text"
                      className="form-input"
                      value={draft.form.amount}
                      onChange={(event) => updateDraft(draft.id, { amount: event.target.value })}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <select
                      className="form-input"
                      value={draft.form.categoryId}
                      onChange={(event) =>
                        updateDraft(draft.id, {
                          categoryId: event.target.value,
                          subcategoryId: "",
                        })
                      }
                    >
                      <option value="">Uncategorized</option>
                      {rootCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-2">
                    <select
                      className="form-input"
                      value={draft.form.subcategoryId}
                      disabled={!draft.form.categoryId}
                      onChange={(event) =>
                        updateDraft(draft.id, { subcategoryId: event.target.value })
                      }
                    >
                      <option value="">None</option>
                      {subcategoriesForCategory(draft.form.categoryId).map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="text"
                      className="form-input"
                      value={draft.form.ref}
                      onChange={(event) => updateDraft(draft.id, { ref: event.target.value })}
                    />
                  </td>
                  <td className="py-2">
                    <BulkEditTagsCell
                      tagIds={draft.form.tagIds}
                      allTags={allTags}
                      onChange={(tagIds) => updateDraft(draft.id, { tagIds })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pageCount > 1 ? (
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-slate-600">
            {page * DEFAULT_LIST_PAGE_SIZE + 1}–
            {Math.min((page + 1) * DEFAULT_LIST_PAGE_SIZE, drafts.length)} of {drafts.length}
          </span>
          <div className="flex gap-2">
            <SecondaryButton
              type="button"
              disabled={page === 0}
              onClick={() => setPage((current) => current - 1)}
            >
              Previous
            </SecondaryButton>
            <SecondaryButton
              type="button"
              disabled={page >= pageCount - 1}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </SecondaryButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}
