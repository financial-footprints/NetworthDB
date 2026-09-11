import { PrimaryButton, SecondaryButton } from "@web/components/button";
import { FormErrorSummary } from "@web/components/fields/FormErrorSummary";
import { FormRow } from "@web/components/fields/FormRow";
import { PasswordInput } from "@web/components/fields/PasswordInput";
import { StackedModalShell } from "@web/context/Settings/components/StackedModalShell";
import { type SubmitEvent, useEffect, useState } from "react";

export type VaultPasswordModalMode = "create" | "unlock";

type VaultPasswordModalProps = {
  isOpen: boolean;
  mode: VaultPasswordModalMode;
  submitting: boolean;
  errorMessages: string[];
  onClose: () => void;
  onConfirm: (password: string) => void;
};

export function VaultPasswordModal({
  isOpen,
  mode,
  submitting,
  errorMessages,
  onClose,
  onConfirm,
}: VaultPasswordModalProps) {
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (isOpen) {
      setPassword("");
    }
  }, [isOpen]);

  const title = mode === "create" ? "Create encryption vault" : "Unlock encryption vault";
  const subtitle =
    mode === "create"
      ? "Enter your login password to create your vault and save your encrypted name."
      : "Enter your login password to unlock your vault in this tab.";

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password) {
      return;
    }
    onConfirm(password);
  }

  return (
    <StackedModalShell
      isOpen={isOpen}
      title={title}
      subtitle={subtitle}
      busy={submitting}
      onClose={onClose}
    >
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <FormErrorSummary messages={errorMessages} />

        <FormRow label="Current password" htmlFor="vault-modal-password">
          <PasswordInput
            id="vault-modal-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={submitting}
            autoComplete="current-password"
          />
        </FormRow>

        <div className="flex justify-end gap-2">
          <SecondaryButton type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </SecondaryButton>
          <PrimaryButton type="submit" disabled={submitting || !password} aria-busy={submitting}>
            {submitting ? "Saving…" : "Continue"}
          </PrimaryButton>
        </div>
      </form>
    </StackedModalShell>
  );
}
