import { MfaProofCollector } from "@web/components/auth/MfaProofCollector";
import { PrimaryButton, SecondaryButton } from "@web/components/button";
import { FormErrorSummary } from "@web/components/fields/FormErrorSummary";
import { FormRow } from "@web/components/fields/FormRow";
import { PasswordInput } from "@web/components/fields/PasswordInput";
import { useAuth } from "@web/context/Auth/AuthContext";
import { StackedModalShell } from "@web/context/Settings/components/StackedModalShell";
import type { MfaProofPayload } from "@web/utils/api/endpoints/auth/mfa";
import { type SubmitEvent, useEffect, useState } from "react";

export type SecurityConfirmResult = {
  password: string;
  totp?: string;
  recovery_code?: string;
};

type SecurityConfirmModalProps = {
  isOpen: boolean;
  title: string;
  description?: string;
  mfaEnabled: boolean;
  passwordRequired?: boolean;
  pendingPassword?: string;
  confirmLabel?: string;
  submitting: boolean;
  errorMessages: string[];
  onClose: () => void;
  onConfirm: (result: SecurityConfirmResult) => void;
};

export function SecurityConfirmModal({
  isOpen,
  title,
  description,
  mfaEnabled,
  passwordRequired = true,
  pendingPassword,
  confirmLabel,
  submitting,
  errorMessages,
  onClose,
  onConfirm,
}: SecurityConfirmModalProps) {
  const { user } = useAuth();
  const [password, setPassword] = useState("");
  const [mfaProof, setMfaProof] = useState<MfaProofPayload | null>(null);
  const [localErrors, setLocalErrors] = useState<string[]>([]);
  const [passkeyBusy, setPasskeyBusy] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPassword("");
      setMfaProof(null);
      setLocalErrors([]);
      setPasskeyBusy(false);
    }
  }, [isOpen]);

  const busy = submitting || passkeyBusy;
  const messages = [...localErrors, ...errorMessages];

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalErrors([]);

    const resolvedPassword = passwordRequired ? password : (pendingPassword ?? "");

    if (passwordRequired && !password) {
      setLocalErrors(["Current password is required."]);
      return;
    }

    if (!passwordRequired && !resolvedPassword) {
      setLocalErrors(["Password confirmation is unavailable. Try saving again."]);
      return;
    }

    if (mfaEnabled && !mfaProof?.totp && !mfaProof?.recovery_code) {
      setLocalErrors(["Enter an authenticator code or recovery code."]);
      return;
    }

    onConfirm({
      password: resolvedPassword,
      totp: mfaProof?.totp,
      recovery_code: mfaProof?.recovery_code,
    });
  }

  return (
    <StackedModalShell
      isOpen={isOpen}
      title={title}
      description={description}
      busy={busy}
      onClose={onClose}
      panelClassName="relative w-full max-w-md rounded-sm bg-white p-6 shadow-xl"
    >
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <FormErrorSummary messages={messages} />

        {passwordRequired ? (
          <FormRow label="Current password" htmlFor="security-password">
            <PasswordInput
              id="security-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={busy}
              autoComplete="current-password"
            />
          </FormRow>
        ) : null}

        {mfaEnabled && user ? (
          <MfaProofCollector
            user={user}
            mode="fields"
            allowedMethods={["totp", "recovery"]}
            includeRecoveryCode
            disabled={busy}
            onProofReady={() => {}}
            onProofChange={setMfaProof}
            onBusyChange={setPasskeyBusy}
          />
        ) : null}

        <div className="flex justify-end gap-2">
          <SecondaryButton type="button" onClick={onClose} disabled={busy}>
            Cancel
          </SecondaryButton>
          <PrimaryButton type="submit" disabled={busy} aria-busy={submitting}>
            {submitting ? "Saving…" : (confirmLabel ?? "Confirm")}
          </PrimaryButton>
        </div>
      </form>
    </StackedModalShell>
  );
}
