import { PrimaryButton, SecondaryButton } from "@web/components/button";
import { FormErrorSummary } from "@web/components/fields/FormErrorSummary";
import { FormRow } from "@web/components/fields/FormRow";
import { PasswordInput } from "@web/components/fields/PasswordInput";
import { StackedModalShell } from "@web/context/Settings/components/StackedModalShell";
import type { WebAuthnCredential } from "@web/utils/api/endpoints/auth/mfa";
import { type SubmitEvent, useEffect, useState } from "react";

type AddPasskeyVaultModalProps = {
  isOpen: boolean;
  passkeys: WebAuthnCredential[];
  submitting: boolean;
  errorMessages: string[];
  onClose: () => void;
  onConfirm: (passkey: WebAuthnCredential, label: string, password: string) => void;
};

export function AddPasskeyVaultModal({
  isOpen,
  passkeys,
  submitting,
  errorMessages,
  onClose,
  onConfirm,
}: AddPasskeyVaultModalProps) {
  const [selectedId, setSelectedId] = useState("");
  const [label, setLabel] = useState("");
  const [password, setPassword] = useState("");
  const [localErrors, setLocalErrors] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      const first = passkeys[0];
      setSelectedId(first?.id ?? "");
      setLabel(first?.name ?? "");
      setPassword("");
      setLocalErrors([]);
    }
  }, [isOpen, passkeys]);

  const messages = [...localErrors, ...errorMessages];

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalErrors([]);
    const passkey = passkeys.find((entry) => entry.id === selectedId);
    if (!passkey) {
      setLocalErrors(["Select a passkey."]);
      return;
    }
    if (!password) {
      setLocalErrors(["Login password is required."]);
      return;
    }
    onConfirm(passkey, label.trim() || passkey.name || "Passkey", password);
  }

  return (
    <StackedModalShell
      isOpen={isOpen}
      title="Link passkey"
      description="Your passkey can unlock the vault without typing your password. Up to two passkeys unlock in one step; additional keys may need a separate unlock."
      busy={submitting}
      onClose={onClose}
    >
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <FormErrorSummary messages={messages} />

        <FormRow label="Passkey" htmlFor="vault-passkey-select" required>
          <select
            id="vault-passkey-select"
            value={selectedId}
            onChange={(event) => {
              const nextId = event.target.value;
              setSelectedId(nextId);
              const passkey = passkeys.find((entry) => entry.id === nextId);
              if (passkey && !label) {
                setLabel(passkey.name || "Passkey");
              }
            }}
            disabled={submitting}
            className="form-input"
          >
            {passkeys.map((passkey) => (
              <option key={passkey.id} value={passkey.id}>
                {passkey.name || "Passkey"}
              </option>
            ))}
          </select>
        </FormRow>

        <FormRow label="Label" htmlFor="vault-passkey-label" encryptionKind="e2ee">
          <input
            id="vault-passkey-label"
            type="text"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            disabled={submitting}
            maxLength={128}
            className="form-input"
          />
        </FormRow>

        <FormRow label="Login Password" htmlFor="vault-passkey-password" required>
          <PasswordInput
            id="vault-passkey-password"
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
            {submitting ? "Linking…" : "Link passkey"}
          </PrimaryButton>
        </div>
      </form>
    </StackedModalShell>
  );
}
