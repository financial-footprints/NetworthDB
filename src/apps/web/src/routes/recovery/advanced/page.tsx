import type { AdvancedRecoveryContextApi } from "@ndb/platform";
import { LoginCard } from "@web/components/Auth/LoginCard";
import { PrimaryButton } from "@web/components/Button";
import { FormErrorSummary } from "@web/components/Fields/FormErrorSummary";
import { FormRow } from "@web/components/Fields/FormRow";
import { PasswordInput } from "@web/components/Fields/PasswordInput";
import { PageTitle } from "@web/components/Layout/PageTitle";
import { path } from "@web/router/routes";
import {
  completeAdvancedRecovery,
  readAdvancedRecoveryContext,
  readRecoveryTokenFromHash,
} from "@web/utils/api/routes/auth/recovery";
import { rewrapVault, unlockVaultManual } from "@web/utils/crypto/vault";
import { errorMessage } from "@web/utils/errors";
import { type SubmitEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

function InvalidRecoveryLinkView() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <PageTitle page="Advanced Recovery" />
      <LoginCard size="content">
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-4">
          <h1 className="text-base font-semibold text-slate-900">Invalid recovery link</h1>
          <p className="text-sm text-slate-600">
            This advanced recovery link is missing or invalid. Request a new recovery email to
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

function RecoveryAdvancedLoadingView() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <PageTitle page="Advanced Recovery" />
      <LoginCard size="content">
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
          <p className="text-slate-600">Loading recovery details…</p>
        </div>
      </LoginCard>
    </div>
  );
}

function RecoveryCompletedView({ onGoToLogin }: { onGoToLogin: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center gap-4">
      <h1 className="text-base font-semibold text-slate-900">Account recovered</h1>
      <p className="text-sm text-slate-600">
        Your password was reset and vault access was restored. Sign in with your new password.
      </p>
      <PrimaryButton type="button" onClick={onGoToLogin}>
        Go to login
      </PrimaryButton>
    </div>
  );
}

function PasskeyRecoveryRequiredView() {
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center gap-4">
      <h1 className="text-base font-semibold text-slate-900">Passkey recovery required</h1>
      <p className="text-sm text-slate-600">
        This account can only be recovered with a registered passkey. Web-based passkey recovery is
        not available here yet.
      </p>
      <Link
        to={path.recovery.request}
        className="text-sm font-medium text-[#1a5fb4] hover:text-[#1557a0]"
      >
        Request another recovery email
      </Link>
    </div>
  );
}

type RecoveryFormProps = {
  requiresVaultUnlock: boolean;
  supportsRecoveryPhrase: boolean;
  recoveryPhrase: string;
  setRecoveryPhrase: (value: string) => void;
  newPassword: string;
  setNewPassword: (value: string) => void;
  confirmPassword: string;
  setConfirmPassword: (value: string) => void;
  submitting: boolean;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
};

function RecoveryAdvancedForm({
  requiresVaultUnlock,
  supportsRecoveryPhrase,
  recoveryPhrase,
  setRecoveryPhrase,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  submitting,
  onSubmit,
}: RecoveryFormProps) {
  return (
    <form className="flex min-h-0 flex-1 flex-col gap-5" onSubmit={onSubmit} noValidate>
      <div>
        <h1 className="text-base font-semibold text-slate-900">Advanced account recovery</h1>
        <p className="mt-1 text-sm text-slate-600">
          {requiresVaultUnlock
            ? "Unlock your vault with a recovery phrase, then choose a new login password."
            : "Choose a new login password to finish recovery."}
        </p>
      </div>

      {requiresVaultUnlock && supportsRecoveryPhrase ? (
        <FormRow
          label="Recovery Phrase"
          htmlFor="advanced-recovery-phrase"
          required
          info="Enter the 12-word recovery phrase you saved when you created this vault key."
          infoAriaLabel="Recovery phrase help"
        >
          <textarea
            id="advanced-recovery-phrase"
            name="recovery-phrase"
            rows={3}
            value={recoveryPhrase}
            onChange={(event) => setRecoveryPhrase(event.target.value)}
            disabled={submitting}
            className="form-input min-h-24 resize-y"
            autoComplete="off"
            spellCheck={false}
          />
        </FormRow>
      ) : null}

      <FormRow label="New Password" htmlFor="advanced-new-password" required>
        <PasswordInput
          id="advanced-new-password"
          name="new-password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          disabled={submitting}
        />
      </FormRow>

      <FormRow label="Confirm Password" htmlFor="advanced-confirm-password" required>
        <PasswordInput
          id="advanced-confirm-password"
          name="confirm-password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          disabled={submitting}
        />
      </FormRow>

      <div className="mt-auto flex justify-end pt-1">
        <PrimaryButton type="submit" disabled={submitting} aria-busy={submitting}>
          {submitting ? "Recovering…" : "Complete Recovery"}
        </PrimaryButton>
      </div>
    </form>
  );
}

function validateRecoverySubmit(input: {
  newPassword: string;
  confirmPassword: string;
  requiresVaultUnlock: boolean;
  supportsRecoveryPhrase: boolean;
  recoveryPhrase: string;
}): string[] {
  if (!input.newPassword) {
    return ["New password is required."];
  }
  if (input.newPassword !== input.confirmPassword) {
    return ["Passwords do not match."];
  }
  if (input.requiresVaultUnlock && input.supportsRecoveryPhrase && !input.recoveryPhrase.trim()) {
    return ["Recovery phrase is required to unlock your vault."];
  }
  return [];
}

async function submitAdvancedRecovery(input: {
  token: string;
  context: AdvancedRecoveryContextApi | null;
  newPassword: string;
  requiresVaultUnlock: boolean;
  supportsRecoveryPhrase: boolean;
  recoveryPhrase: string;
}): Promise<void> {
  let passwordSlot: { salt: string; wrapBlob: string } | undefined;

  if (input.requiresVaultUnlock && input.supportsRecoveryPhrase) {
    const slots = (input.context?.vaultSlots ?? []).map((slot) => ({
      slotType: slot.slotType,
      salt: slot.salt,
      wrapBlob: slot.wrapBlob,
    }));
    const dek = await unlockVaultManual(slots, {
      recoveryPhrase: input.recoveryPhrase.trim(),
    });
    passwordSlot = await rewrapVault(dek, input.newPassword);
  }

  await completeAdvancedRecovery({
    token: input.token,
    newPassword: input.newPassword,
    passwordSlot,
  });
}

export default function RecoveryAdvancedPage() {
  const navigate = useNavigate();
  const token = useMemo(() => readRecoveryTokenFromHash(), []);
  const [context, setContext] = useState<AdvancedRecoveryContextApi | null>(null);
  const [loadingContext, setLoadingContext] = useState(Boolean(token));
  const [recoveryPhrase, setRecoveryPhrase] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;
    setLoadingContext(true);
    void readAdvancedRecoveryContext(token)
      .then((loaded) => {
        if (!cancelled) {
          setContext(loaded);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setErrorMessages([
            errorMessage(error, "Could not load advanced recovery details. Please try again."),
          ]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingContext(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!token) {
    return <InvalidRecoveryLinkView />;
  }

  const recoveryToken = token;

  const supportsRecoveryPhrase = context?.vaultRecoveryMethods.includes("recovery_phrase") ?? false;
  const requiresVaultUnlock = context?.vaultInitialized === true;

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessages([]);

    const validationErrors = validateRecoverySubmit({
      newPassword,
      confirmPassword,
      requiresVaultUnlock,
      supportsRecoveryPhrase,
      recoveryPhrase,
    });
    if (validationErrors.length > 0) {
      setErrorMessages(validationErrors);
      return;
    }

    if (!recoveryToken) {
      return;
    }

    setSubmitting(true);
    try {
      await submitAdvancedRecovery({
        token: recoveryToken,
        context,
        newPassword,
        requiresVaultUnlock,
        supportsRecoveryPhrase,
        recoveryPhrase,
      });
      setCompleted(true);
    } catch (error) {
      setErrorMessages([
        errorMessage(error, "Could not complete advanced recovery. Please try again."),
      ]);
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingContext) {
    return <RecoveryAdvancedLoadingView />;
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <PageTitle page="Advanced Recovery" />

      {errorMessages.length > 0 ? <FormErrorSummary title="" messages={errorMessages} /> : null}

      <LoginCard size="content">
        {completed ? (
          <RecoveryCompletedView
            onGoToLogin={() => {
              navigate(path.login, { replace: true });
            }}
          />
        ) : requiresVaultUnlock && !supportsRecoveryPhrase ? (
          <PasskeyRecoveryRequiredView />
        ) : (
          <RecoveryAdvancedForm
            requiresVaultUnlock={requiresVaultUnlock}
            supportsRecoveryPhrase={supportsRecoveryPhrase}
            recoveryPhrase={recoveryPhrase}
            setRecoveryPhrase={setRecoveryPhrase}
            newPassword={newPassword}
            setNewPassword={setNewPassword}
            confirmPassword={confirmPassword}
            setConfirmPassword={setConfirmPassword}
            submitting={submitting}
            onSubmit={handleSubmit}
          />
        )}
      </LoginCard>
    </div>
  );
}
