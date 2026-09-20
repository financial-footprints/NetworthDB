import { normalizeRecoveryCode, useMfaVerifyErrors } from "@web/components/Auth/helpers";
import { MfaVerifyActions } from "@web/components/Auth/MfaVerifyActions";
import { FormErrorSummary } from "@web/components/Fields/FormErrorSummary";
import { FormRow } from "@web/components/Fields/FormRow";
import { mfaVerify } from "@web/utils/api/routes/auth";
import type { TokenPair } from "@web/utils/api/routes/auth/types";
import { ApiError } from "@web/utils/api/types";
import { errorMessage } from "@web/utils/errors";
import { type SubmitEvent, useState } from "react";

type RecoveryCodeVerifyPanelProps = {
  getBearerToken: () => Promise<string>;
  onComplete: (tokens: TokenPair) => void;
  onBack?: () => void;
  onErrorMessagesChange?: (messages: string[]) => void;
};

export function RecoveryCodeVerifyPanel({
  getBearerToken,
  onComplete,
  onBack,
  onErrorMessagesChange,
}: RecoveryCodeVerifyPanelProps) {
  const [recoveryCode, setRecoveryCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { setErrors, showInlineErrors, localErrorMessages } =
    useMfaVerifyErrors(onErrorMessagesChange);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors([]);

    const trimmedCode = normalizeRecoveryCode(recoveryCode);
    if (!trimmedCode) {
      setErrors(["Enter a recovery code."]);
      return;
    }

    setSubmitting(true);
    try {
      const bearerToken = await getBearerToken();
      const tokens = await mfaVerify(bearerToken, {
        recoveryCode: trimmedCode,
      });
      onComplete(tokens);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setErrors(["Invalid recovery code. Please try again."]);
        return;
      }
      setErrors([errorMessage(error, "Could not verify sign-in. Please try again.")]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="flex min-h-0 flex-1 flex-col gap-4" onSubmit={handleSubmit} noValidate>
      {showInlineErrors && localErrorMessages.length > 0 ? (
        <FormErrorSummary title="" messages={localErrorMessages} />
      ) : null}

      <FormRow
        label="Recovery Code"
        htmlFor="recovery-verify-code"
        required
        infoAriaLabel="About recovery codes"
        info={<>Enter one of your unused recovery codes. Each code can only be used once.</>}
      >
        <input
          id="recovery-verify-code"
          type="text"
          value={recoveryCode}
          onChange={(event) => setRecoveryCode(event.target.value)}
          disabled={submitting}
          className="form-input"
          autoComplete="off"
          placeholder="Enter unused recovery code"
        />
      </FormRow>

      <MfaVerifyActions
        onBack={onBack}
        backDisabled={submitting}
        primary={{
          label: "Verify",
          submittingLabel: "Verifying…",
          submitting,
        }}
      />
    </form>
  );
}
