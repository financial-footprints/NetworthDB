import { PrimaryButton, SecondaryButton } from "@web/components/button";
import { FormErrorSummary } from "@web/components/fields/FormErrorSummary";
import { FormRow } from "@web/components/fields/FormRow";
import { PasswordInput } from "@web/components/fields/PasswordInput";
import { StackedModalShell } from "@web/context/Settings/components/StackedModalShell";
import { generateRecoveryPhrase } from "@web/utils/crypto/vault";
import { type SubmitEvent, useEffect, useState } from "react";

type AddRecoveryPhraseModalProps = {
  isOpen: boolean;
  submitting: boolean;
  errorMessages: string[];
  onClose: () => void;
  onConfirm: (phrase: string, label: string, password: string) => void;
};

type Step = "display" | "authorize";

export function AddRecoveryPhraseModal({
  isOpen,
  submitting,
  errorMessages,
  onClose,
  onConfirm,
}: AddRecoveryPhraseModalProps) {
  const [step, setStep] = useState<Step>("display");
  const [phrase, setPhrase] = useState("");
  const [savedConfirmed, setSavedConfirmed] = useState(false);
  const [label, setLabel] = useState("");
  const [password, setPassword] = useState("");
  const [localErrors, setLocalErrors] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setStep("display");
      setPhrase(generateRecoveryPhrase());
      setSavedConfirmed(false);
      setLabel("");
      setPassword("");
      setLocalErrors([]);
    }
  }, [isOpen]);

  const messages = [...localErrors, ...errorMessages];

  async function copyPhrase() {
    try {
      await navigator.clipboard.writeText(phrase);
    } catch {
      setLocalErrors(["Could not copy to clipboard."]);
    }
  }

  function handleDisplayContinue(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalErrors([]);
    if (!savedConfirmed) {
      setLocalErrors(["Confirm that you have saved the recovery phrase."]);
      return;
    }
    setStep("authorize");
  }

  function handleAuthorizeSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalErrors([]);
    if (!password) {
      setLocalErrors(["Login password is required."]);
      return;
    }
    onConfirm(phrase, label.trim(), password);
  }

  return (
    <StackedModalShell
      isOpen={isOpen}
      title="Add recovery phrase"
      description="Recovery phrases are stored only on your devices. We never see the words."
      busy={submitting}
      onClose={onClose}
      panelClassName="relative w-full max-w-lg rounded-sm bg-white p-6 shadow-xl"
    >
      {step === "display" ? (
        <form className="space-y-4" onSubmit={handleDisplayContinue} noValidate>
          <FormErrorSummary messages={messages} />

          <p className="text-sm text-red-700" role="alert">
            This phrase will not be shown again. Without it, this key cannot be recovered.
          </p>

          <div className="rounded-sm border border-slate-200 bg-slate-50 p-3 font-mono text-sm leading-relaxed text-slate-900">
            {phrase}
          </div>

          <SecondaryButton type="button" onClick={() => void copyPhrase()}>
            Copy to clipboard
          </SecondaryButton>

          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={savedConfirmed}
              onChange={(event) => setSavedConfirmed(event.target.checked)}
              className="mt-0.5"
            />
            I have saved this recovery phrase in a safe place.
          </label>

          <div className="flex justify-end gap-2">
            <SecondaryButton type="button" onClick={onClose} disabled={submitting}>
              Cancel
            </SecondaryButton>
            <PrimaryButton type="submit" disabled={!savedConfirmed}>
              Continue
            </PrimaryButton>
          </div>
        </form>
      ) : (
        <form className="space-y-4" onSubmit={handleAuthorizeSubmit} noValidate>
          <FormErrorSummary messages={messages} />

          <FormRow label="Label" htmlFor="recovery-phrase-label" encryptionKind="e2ee">
            <input
              id="recovery-phrase-label"
              type="text"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              disabled={submitting}
              maxLength={128}
              placeholder="Optional, e.g. Safe deposit box"
              className="form-input"
            />
          </FormRow>

          <FormRow label="Login Password" htmlFor="recovery-phrase-password" required>
            <PasswordInput
              id="recovery-phrase-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={submitting}
              autoComplete="current-password"
            />
          </FormRow>

          <div className="flex justify-end gap-2">
            <SecondaryButton type="button" onClick={() => setStep("display")} disabled={submitting}>
              Back
            </SecondaryButton>
            <PrimaryButton type="submit" disabled={submitting} aria-busy={submitting}>
              {submitting ? "Adding…" : "Add recovery phrase"}
            </PrimaryButton>
          </div>
        </form>
      )}
    </StackedModalShell>
  );
}
