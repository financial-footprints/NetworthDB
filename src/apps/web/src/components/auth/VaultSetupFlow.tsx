import { MfaVerifyActions } from "@web/components/auth/MfaVerifyActions";
import { FormErrorSummary } from "@web/components/fields/FormErrorSummary";
import { FormRow } from "@web/components/fields/FormRow";
import { PasswordInput } from "@web/components/fields/PasswordInput";
import { useAuth } from "@web/context/Auth/AuthContext";
import { errorMessage } from "@web/utils/errors";
import { type SubmitEvent, useState } from "react";

type VaultSetupFlowProps = {
  onComplete: () => void;
  onErrorMessagesChange?: (messages: string[]) => void;
};

export function VaultSetupFlow({ onComplete, onErrorMessagesChange }: VaultSetupFlowProps) {
  const { completeVaultSetup } = useAuth();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);

  function reportErrors(messages: string[]) {
    setErrorMessages(messages);
    onErrorMessagesChange?.(messages);
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password) {
      reportErrors(["Password is required."]);
      return;
    }

    setSubmitting(true);
    reportErrors([]);
    try {
      await completeVaultSetup(password);
      reportErrors([]);
      onComplete();
    } catch (error) {
      reportErrors([errorMessage(error, "Could not set up your encryption vault. Try again.")]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Set up encryption</h2>
        <p className="mt-1 text-sm text-slate-600">
          Enter your login password to create your vault and access encrypted account data in this
          tab.
        </p>
      </div>

      {errorMessages.length > 0 ? <FormErrorSummary title="" messages={errorMessages} /> : null}

      <form className="flex min-h-0 flex-1 flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <FormRow label="Login password" htmlFor="vault-setup-password" required>
          <PasswordInput
            id="vault-setup-password"
            name="vault-setup-password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={submitting}
          />
        </FormRow>
        <MfaVerifyActions
          primary={{
            label: "Continue",
            submittingLabel: "Setting up…",
            submitting,
          }}
        />
      </form>
    </div>
  );
}
