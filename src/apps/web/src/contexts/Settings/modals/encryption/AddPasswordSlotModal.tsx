import { PrimaryButton, SecondaryButton } from "@web/components/Button";
import { FormErrorSummary } from "@web/components/Fields/FormErrorSummary";
import { FormRow } from "@web/components/Fields/FormRow";
import { PasswordInput } from "@web/components/Fields/PasswordInput";
import { StackedModalShell } from "@web/contexts/Settings/components/StackedModalShell";
import { type SubmitEvent, useEffect, useState } from "react";

type AddPasswordSlotModalProps = {
  isOpen: boolean;
  submitting: boolean;
  errorMessages: string[];
  onClose: () => void;
  onConfirm: (password: string) => void;
};

export function AddPasswordSlotModal({
  isOpen,
  submitting,
  errorMessages,
  onClose,
  onConfirm,
}: AddPasswordSlotModalProps) {
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (isOpen) {
      setPassword("");
    }
  }, [isOpen]);

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
      title="Login Password"
      subtitle="Your sign-in password will also unlock encrypted data in this vault."
      busy={submitting}
      onClose={onClose}
    >
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <FormErrorSummary messages={errorMessages} />

        <FormRow label="Login Password" htmlFor="add-password-slot" required>
          <PasswordInput
            id="add-password-slot"
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
          <PrimaryButton type="submit" disabled={submitting} aria-busy={submitting}>
            {submitting ? "Adding…" : "Add key"}
          </PrimaryButton>
        </div>
      </form>
    </StackedModalShell>
  );
}
