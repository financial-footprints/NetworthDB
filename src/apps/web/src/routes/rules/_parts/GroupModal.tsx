import { PrimaryButton, SecondaryButton } from "@web/components/Button";
import { FormErrorSummary } from "@web/components/Fields/FormErrorSummary";
import { FormRow } from "@web/components/Fields/FormRow";
import { StackedModalShell } from "@web/contexts/Settings/components/StackedModalShell";
import { createRuleGroup, patchRuleGroup } from "@web/utils/api/routes/rule-groups";
import { errorMessage } from "@web/utils/errors";
import { type SubmitEvent, useEffect, useState } from "react";

type RuleGroupFormModalProps = {
  isOpen: boolean;
  mode: "create" | "edit";
  groupId?: string;
  initialTitle?: string;
  initialDescription?: string | null;
  onClose: () => void;
  onSaved: () => void;
};

export function GroupModal({
  isOpen,
  mode,
  groupId,
  initialTitle = "",
  initialDescription = null,
  onClose,
  onSaved,
}: RuleGroupFormModalProps) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setTitle(initialTitle);
      setDescription(initialDescription ?? "");
      setErrorMessages([]);
      setSubmitting(false);
    }
  }, [isOpen, initialTitle, initialDescription]);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setErrorMessages(["Title is required."]);
      return;
    }
    setSubmitting(true);
    setErrorMessages([]);
    try {
      const desc = description.trim() ? description.trim() : null;
      if (mode === "create") {
        await createRuleGroup({ title: trimmed, description: desc });
      } else if (groupId) {
        await patchRuleGroup(groupId, { title: trimmed, description: desc });
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      setErrorMessages([errorMessage(err, "Could not save rule group")]);
    } finally {
      setSubmitting(false);
    }
  }

  const modalTitle = mode === "create" ? "Add Rule Group" : "Edit Rule Group";

  return (
    <StackedModalShell isOpen={isOpen} title={modalTitle} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormErrorSummary messages={errorMessages} />
        <FormRow label="Title">
          <input
            type="text"
            className="form-input w-full"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={128}
          />
        </FormRow>
        <FormRow label="Description">
          <textarea
            className="form-input w-full min-h-[4rem]"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={2048}
          />
        </FormRow>
        <div className="flex justify-end gap-2">
          <SecondaryButton type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </SecondaryButton>
          <PrimaryButton type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save"}
          </PrimaryButton>
        </div>
      </form>
    </StackedModalShell>
  );
}
