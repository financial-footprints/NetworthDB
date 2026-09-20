import { PrimaryButton, SecondaryButton } from "@web/components/Button";
import { FormErrorSummary } from "@web/components/Fields/FormErrorSummary";
import { FormRow } from "@web/components/Fields/FormRow";
import { StackedModalShell } from "@web/contexts/Settings/components/StackedModalShell";
import { createTag, updateTag } from "@web/utils/api/routes/tags";
import { errorMessage } from "@web/utils/errors";
import { type SubmitEvent, useEffect, useState } from "react";

type TagFormModalProps = {
  isOpen: boolean;
  mode: "create" | "edit";
  tagId?: string;
  initialName?: string;
  onClose: () => void;
  onSaved: () => void;
};

export function Modal({
  isOpen,
  mode,
  tagId,
  initialName = "",
  onClose,
  onSaved,
}: TagFormModalProps) {
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
        await createTag({ name: trimmed });
      } else if (tagId) {
        await updateTag(tagId, { name: trimmed });
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      setErrorMessages([errorMessage(err, "Could not save tag")]);
    } finally {
      setSubmitting(false);
    }
  }

  const title = mode === "create" ? "Add Tag" : "Edit Tag";

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
