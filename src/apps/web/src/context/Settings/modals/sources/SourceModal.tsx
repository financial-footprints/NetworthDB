import { PrimaryButton, SecondaryButton } from "@web/components/button";
import { FormErrorSummary } from "@web/components/fields/FormErrorSummary";
import { SourceFields } from "@web/context/Settings/components/SourceFields";
import { StackedModalShell } from "@web/context/Settings/components/StackedModalShell";
import type { SourceConfig } from "@web/utils/api/endpoints/sources/types";
import { validateSource } from "@web/utils/api/endpoints/sources/validation";
import { type SubmitEvent, useEffect, useState } from "react";

type SourceModalProps = {
  isOpen: boolean;
  mode: "add" | "edit";
  source: SourceConfig;
  submitting?: boolean;
  onClose: () => void;
  onConfirm: (source: SourceConfig) => void | Promise<void>;
};

export function SourceModal({
  isOpen,
  mode,
  source,
  submitting = false,
  onClose,
  onConfirm,
}: SourceModalProps) {
  const [draft, setDraft] = useState<SourceConfig>(source);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setDraft(source);
      setErrorMessages([]);
    }
  }, [isOpen, source]);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validateSource(draft);
    if (errors.length > 0) {
      setErrorMessages(errors);
      return;
    }
    void onConfirm(draft);
  }

  return (
    <StackedModalShell
      isOpen={isOpen}
      title={mode === "add" ? "Add Source" : "Edit Source"}
      busy={submitting}
      onClose={onClose}
      panelClassName="relative w-full max-w-lg rounded-sm bg-white p-5 shadow-xl"
    >
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <FormErrorSummary messages={errorMessages} />

        <SourceFields source={draft} disabled={submitting} onChange={setDraft} />

        <div className="flex justify-end gap-2">
          <SecondaryButton type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </SecondaryButton>
          <PrimaryButton type="submit" disabled={submitting} aria-busy={submitting}>
            {submitting
              ? mode === "add"
                ? "Adding…"
                : "Saving…"
              : mode === "add"
                ? "Add"
                : "Save"}
          </PrimaryButton>
        </div>
      </form>
    </StackedModalShell>
  );
}
