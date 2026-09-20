import { PrimaryButton, SecondaryButton } from "@web/components/Button";
import { FormErrorSummary } from "@web/components/Fields/FormErrorSummary";
import { FormRow } from "@web/components/Fields/FormRow";
import { StackedModalShell } from "@web/contexts/Settings/components/StackedModalShell";
import { createCategory, updateCategory } from "@web/utils/api/routes/categories";
import { errorMessage } from "@web/utils/errors";
import { type SubmitEvent, useEffect, useState } from "react";

type CategoryFormModalProps = {
  isOpen: boolean;
  mode: "create" | "edit";
  categoryId?: string;
  parentId?: string | null;
  parentName?: string;
  initialName?: string;
  onClose: () => void;
  onSaved: () => void;
};

export function Modal({
  isOpen,
  mode,
  categoryId,
  parentId = null,
  parentName,
  initialName = "",
  onClose,
  onSaved,
}: CategoryFormModalProps) {
  const [name, setName] = useState(initialName);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setErrorMessages([]);
      setSubmitting(false);
    }
  }, [isOpen, initialName]);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setErrorMessages(["Name is required."]);
      return;
    }
    setSubmitting(true);
    setErrorMessages([]);
    try {
      if (mode === "create") {
        await createCategory({ name: trimmed, parentId });
      } else if (categoryId) {
        await updateCategory(categoryId, { name: trimmed });
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      setErrorMessages([errorMessage(err, "Could not save category")]);
    } finally {
      setSubmitting(false);
    }
  }

  const title =
    mode === "create"
      ? parentId
        ? `Add Subcategory Under ${parentName ?? "Category"}`
        : "Add Category"
      : "Edit Category";

  return (
    <StackedModalShell isOpen={isOpen} title={title} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormErrorSummary messages={errorMessages} />
        <FormRow label="Name">
          <input
            type="text"
            className="form-input w-full"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={64}
          />
        </FormRow>
        <div className="flex justify-end gap-2">
          <SecondaryButton type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </SecondaryButton>
          <PrimaryButton type="submit" disabled={submitting}>
            Save
          </PrimaryButton>
        </div>
      </form>
    </StackedModalShell>
  );
}
