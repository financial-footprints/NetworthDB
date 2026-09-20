import { isTotpCode, normalizeRecoveryCode } from "@web/components/Auth/helpers";
import { LoginCard } from "@web/components/Auth/LoginCard";
import { PrimaryButton } from "@web/components/Button";
import { FormErrorSummary } from "@web/components/Fields/FormErrorSummary";
import { FormRow } from "@web/components/Fields/FormRow";
import { PasswordInput } from "@web/components/Fields/PasswordInput";
import { PageTitle } from "@web/components/Layout/PageTitle";
import { path } from "@web/router/routes";
import {
  completePasswordReset,
  readRecoveryTokenFromHash,
} from "@web/utils/api/routes/auth/recovery";
import { errorMessage } from "@web/utils/errors";
import { type SubmitEvent, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

function validatePasswordRecoverySubmit(input: {
  newPassword: string;
  confirmPassword: string;
  totp: string;
  recoveryCode: string;
}): string[] {
  if (!input.newPassword) {
    return ["New password is required."];
  }
  if (input.newPassword !== input.confirmPassword) {
    return ["Passwords do not match."];
  }

  const trimmedTotp = input.totp.trim();
  const trimmedRecoveryCode = normalizeRecoveryCode(input.recoveryCode);
  if (trimmedTotp && trimmedRecoveryCode) {
    return ["Enter either a verification code or a recovery code, not both."];
  }
  if (trimmedTotp && !isTotpCode(trimmedTotp)) {
    return ["Enter a valid 6-digit verification code."];
  }
  return [];
}

export default function RecoveryPasswordPage() {
  const navigate = useNavigate();
  const token = useMemo(() => readRecoveryTokenFromHash(), []);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [completed, setCompleted] = useState(false);

  if (!token) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <PageTitle page="Password Recovery" />
        <LoginCard size="content">
          <div className="flex min-h-0 flex-1 flex-col justify-center gap-4">
            <h1 className="text-base font-semibold text-slate-900">Invalid recovery link</h1>
            <p className="text-sm text-slate-600">
              This password reset link is missing or invalid. Request a new recovery email to
              continue.
            </p>
            <Link
              to={path.recovery.request}
              className="text-sm font-medium text-[#1a5fb4] hover:text-[#1557a0]"
            >
              Request recovery email
            </Link>
          </div>
        </LoginCard>
      </div>
    );
  }

  const recoveryToken = token;

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessages([]);

    const validationErrors = validatePasswordRecoverySubmit({
      newPassword,
      confirmPassword,
      totp,
      recoveryCode,
    });
    if (validationErrors.length > 0) {
      setErrorMessages(validationErrors);
      return;
    }

    const trimmedTotp = totp.trim();
    const trimmedRecoveryCode = normalizeRecoveryCode(recoveryCode);

    setSubmitting(true);
    try {
      await completePasswordReset({
        token: recoveryToken,
        newPassword: newPassword,
        totp: trimmedTotp || undefined,
        recoveryCode: trimmedRecoveryCode || undefined,
      });
      setCompleted(true);
    } catch (error) {
      setErrorMessages([errorMessage(error, "Could not reset your password. Please try again.")]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <PageTitle page="Password Recovery" />

      {errorMessages.length > 0 ? <FormErrorSummary title="" messages={errorMessages} /> : null}

      <LoginCard size="content">
        {completed ? (
          <div className="flex min-h-0 flex-1 flex-col justify-center gap-4">
            <h1 className="text-base font-semibold text-slate-900">Password updated</h1>
            <p className="text-sm text-slate-600">
              Your password was reset. Sign in with your new password to continue.
            </p>
            <PrimaryButton
              type="button"
              onClick={() => {
                navigate(path.login, { replace: true });
              }}
            >
              Go to login
            </PrimaryButton>
          </div>
        ) : (
          <form className="flex min-h-0 flex-1 flex-col gap-5" onSubmit={handleSubmit} noValidate>
            <div>
              <h1 className="text-base font-semibold text-slate-900">Choose a new password</h1>
              <p className="mt-1 text-sm text-slate-600">
                If multi-factor authentication was enabled, provide your authenticator code or a
                recovery code below.
              </p>
            </div>

            <FormRow label="New Password" htmlFor="recovery-new-password" required>
              <PasswordInput
                id="recovery-new-password"
                name="new-password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                disabled={submitting}
              />
            </FormRow>

            <FormRow label="Confirm Password" htmlFor="recovery-confirm-password" required>
              <PasswordInput
                id="recovery-confirm-password"
                name="confirm-password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={submitting}
              />
            </FormRow>

            <FormRow
              label="Verification Code"
              htmlFor="recovery-totp"
              info="Required when TOTP was enabled on the account."
              infoAriaLabel="About verification code"
            >
              <input
                id="recovery-totp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={totp}
                onChange={(event) => setTotp(event.target.value)}
                disabled={submitting}
                className="form-input"
              />
            </FormRow>

            <FormRow
              label="Recovery Code"
              htmlFor="recovery-code"
              info="Use one unused recovery code instead of a verification code when needed."
              infoAriaLabel="About recovery codes"
            >
              <input
                id="recovery-code"
                type="text"
                value={recoveryCode}
                onChange={(event) => setRecoveryCode(event.target.value)}
                disabled={submitting}
                className="form-input"
                autoComplete="off"
              />
            </FormRow>

            <div className="mt-auto flex justify-end pt-1">
              <PrimaryButton type="submit" disabled={submitting} aria-busy={submitting}>
                {submitting ? "Updating…" : "Reset Password"}
              </PrimaryButton>
            </div>
          </form>
        )}
      </LoginCard>
    </div>
  );
}
