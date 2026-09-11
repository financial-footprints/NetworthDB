import {
  isTotpCode,
  TOTP_CODE_INVALID_MESSAGE,
  TOTP_CODE_UNAUTHORIZED_MESSAGE,
  useMfaVerifyErrors,
} from "@web/components/auth/helper";
import { MfaVerifyActions } from "@web/components/auth/MfaVerifyActions";
import { FormErrorSummary } from "@web/components/fields/FormErrorSummary";
import { FormRow } from "@web/components/fields/FormRow";
import { mfaVerify } from "@web/utils/api/endpoints/auth";
import type { TokenPair } from "@web/utils/api/endpoints/auth/types";
import { ApiError } from "@web/utils/api/types";
import { errorMessage } from "@web/utils/errors";
import { type SubmitEvent, useState } from "react";

type TotpVerifyPanelProps = {
  getBearerToken: () => Promise<string>;
  onComplete: (tokens: TokenPair) => void;
  onBack?: () => void;
  onErrorMessagesChange?: (messages: string[]) => void;
};

export function TotpVerifyPanel({
  getBearerToken,
  onComplete,
  onBack,
  onErrorMessagesChange,
}: TotpVerifyPanelProps) {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { setErrors, showInlineErrors, localErrorMessages } =
    useMfaVerifyErrors(onErrorMessagesChange);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors([]);

    const trimmedCode = code.trim();
    if (!isTotpCode(trimmedCode)) {
      setErrors([TOTP_CODE_INVALID_MESSAGE]);
      return;
    }

    setSubmitting(true);
    try {
      const bearerToken = await getBearerToken();
      const tokens = await mfaVerify(bearerToken, { totp: trimmedCode });
      onComplete(tokens);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setErrors([TOTP_CODE_UNAUTHORIZED_MESSAGE]);
        return;
      }
      setErrors([errorMessage(error, "Could not verify sign-in. Please try again.")]);
    } finally {
      setSubmitting(false);
    }
  }

  function handleCodeChange(value: string) {
    setCode(value);
    setErrors([]);
  }

  return (
    <form className="flex min-h-0 flex-1 flex-col gap-4" onSubmit={handleSubmit} noValidate>
      {showInlineErrors && localErrorMessages.length > 0 ? (
        <FormErrorSummary title="" messages={localErrorMessages} />
      ) : null}

      <FormRow
        label="Verification Code"
        htmlFor="totp-verify-code"
        required
        info={TOTP_CODE_INVALID_MESSAGE}
        infoAriaLabel="About verification code"
      >
        <input
          id="totp-verify-code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          value={code}
          onChange={(event) => handleCodeChange(event.target.value)}
          disabled={submitting}
          placeholder="6-digit code"
          className="form-input"
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
