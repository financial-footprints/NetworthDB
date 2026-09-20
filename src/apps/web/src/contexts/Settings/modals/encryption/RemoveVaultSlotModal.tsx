import { PrimaryButton, SecondaryButton } from "@web/components/Button";
import { FormErrorSummary } from "@web/components/Fields/FormErrorSummary";
import { FormRow } from "@web/components/Fields/FormRow";
import { PasswordInput } from "@web/components/Fields/PasswordInput";
import { StackedModalShell } from "@web/contexts/Settings/components/StackedModalShell";
import type { VaultSlot } from "@web/utils/api/routes/auth/types";
import { type SubmitEvent, useEffect, useState } from "react";

type RemoveVaultSlotModalProps = {
  isOpen: boolean;
  slot: VaultSlot | null;
  slotLabel: string;
  submitting: boolean;
  errorMessages: string[];
  onClose: () => void;
  onConfirm: (password: string) => void;
};

function removeWarning(slot: VaultSlot, label: string): string {
  if (slot.slotType === "password") {
    return "You will need another key (recovery phrase or passkey) to unlock encrypted data. You can re-add later with your login password.";
  }
  if (slot.slotType === "webauthn_prf") {
    return "This passkey will no longer unlock your vault. MFA sign-in is unaffected.";
  }
  return `Encrypted data cannot be recovered with ${label} afterward.`;
}

function removeTitle(slot: VaultSlot, label: string): string {
  if (slot.slotType === "password") {
    return "Remove login password key?";
  }
  if (slot.slotType === "webauthn_prf") {
    return `Remove passkey key "${label}"?`;
  }
  return `Remove recovery phrase "${label}"?`;
}

export function RemoveVaultSlotModal({
  isOpen,
  slot,
  slotLabel,
  submitting,
  errorMessages,
  onClose,
  onConfirm,
}: RemoveVaultSlotModalProps) {
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (isOpen) {
      setPassword("");
    }
  }, [isOpen]);

  if (!slot) {
    return null;
  }

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
      title={removeTitle(slot, slotLabel)}
      subtitle={removeWarning(slot, slotLabel)}
      busy={submitting}
      onClose={onClose}
    >
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <FormErrorSummary messages={errorMessages} />

        <FormRow label="Login Password" htmlFor="remove-slot-password" required>
          <PasswordInput
            id="remove-slot-password"
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
            {submitting ? "Removing…" : "Remove"}
          </PrimaryButton>
        </div>
      </form>
    </StackedModalShell>
  );
}
