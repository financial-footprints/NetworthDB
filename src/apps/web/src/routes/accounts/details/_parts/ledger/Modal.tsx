import { PrimaryButton, SecondaryButton } from "@web/components/Button";
import { FormErrorSummary } from "@web/components/Fields/FormErrorSummary";
import { Dialog } from "@web/components/Modal/Dialog";
import { path } from "@web/router/routes";
import {
  persistLedgerTransaction,
  validateLedgerFormForSubmit,
} from "@web/routes/accounts/details/_parts/ledger/helpers";
import {
  type LedgerFormState,
  type PickerOption,
  TransactionFormFields,
} from "@web/routes/accounts/details/_parts/ledger/TransactionFormFields";
import type { CategoryApi } from "@web/utils/api/routes/categories/types";
import type { TagApi } from "@web/utils/api/routes/tags/types";
import { errorMessage } from "@web/utils/errors";
import { type SubmitEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";

type AddTransactionModalProps = {
  open: boolean;
  onClose: () => void;
  mode: "add" | "edit";
  accountId: string;
  transactionId?: string;
  initialValues: LedgerFormState;
  rootCategories: CategoryApi[];
  partyOptions: PickerOption[];
  subcategoriesForCategory: (categoryId: string) => CategoryApi[];
  allTags: TagApi[];
  onSaved: () => void;
};

export function Modal({
  open,
  onClose,
  mode,
  accountId,
  transactionId,
  initialValues,
  rootCategories,
  partyOptions,
  subcategoriesForCategory,
  allTags,
  onSaved,
}: AddTransactionModalProps) {
  const [form, setForm] = useState<LedgerFormState>(initialValues);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setForm(initialValues);
    setErrorMessages([]);
    setSubmitting(false);
  }, [open, initialValues]);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const validated = validateLedgerFormForSubmit(form);
    if (!validated.ok) {
      setErrorMessages(validated.messages);
      return;
    }

    setSubmitting(true);
    setErrorMessages([]);
    try {
      const saveError = await persistLedgerTransaction(
        mode,
        accountId,
        transactionId,
        validated.body
      );
      if (saveError) {
        setErrorMessages([saveError]);
        return;
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      setErrorMessages([errorMessage(err, "Could not save transaction")]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={mode === "edit" ? "Edit Transaction" : "Add Transaction"}
      size="md"
      busy={submitting}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <Link to={path.categories.list} className="btn-secondary">
              Manage Categories
            </Link>
            <Link to={path.tags.list} className="btn-secondary">
              Manage Tags
            </Link>
          </div>
          <div className="flex gap-2">
            <SecondaryButton type="button" onClick={onClose} disabled={submitting}>
              Cancel
            </SecondaryButton>
            <PrimaryButton type="submit" form="transaction-form" disabled={submitting}>
              Save
            </PrimaryButton>
          </div>
        </div>
      }
    >
      <form id="transaction-form" onSubmit={handleSubmit} className="space-y-4">
        <FormErrorSummary messages={errorMessages} />
        <TransactionFormFields
          form={form}
          onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
          partyOptions={partyOptions}
          rootCategories={rootCategories}
          subcategoriesForCategory={subcategoriesForCategory}
          allTags={allTags}
        />
      </form>
    </Dialog>
  );
}
