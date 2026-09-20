import { PrimaryButton, SecondaryButton } from "@web/components/Button";
import { FormErrorSummary } from "@web/components/Fields/FormErrorSummary";
import { FormRow } from "@web/components/Fields/FormRow";
import { PasswordInput } from "@web/components/Fields/PasswordInput";
import { useAuth } from "@web/contexts/Auth/Context";
import { useNotifications } from "@web/contexts/Notifications/Context";
import { StackedModalShell } from "@web/contexts/Settings/components/StackedModalShell";
import {
  fetchMe,
  patchMeWithToken,
  updateVaultSlot,
  withSessionToken,
} from "@web/utils/api/routes/auth";
import type { MeResponse, TokenPair } from "@web/utils/api/routes/auth/types";
import { ApiError } from "@web/utils/api/types";
import { readDEK } from "@web/utils/crypto/session";
import { findPasswordSlot, rewrapVault, unlockVault } from "@web/utils/crypto/vault";
import { errorMessage } from "@web/utils/errors";
import { type SubmitEvent, useEffect, useState } from "react";

const VAULT_UNLOCK_FAILED = "vault_unlock_failed";

type ChangePasswordModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

function validateChangePasswordForm(
  password: string,
  newPassword: string,
  confirmNewPassword: string
): string | null {
  if (!password) {
    return "Current password is required.";
  }
  if (!newPassword) {
    return "New password is required.";
  }
  if (newPassword !== confirmNewPassword) {
    return "New passwords do not match.";
  }
  return null;
}

async function changePasswordAndRewrapVault(
  sessionToken: string,
  password: string,
  newPassword: string,
  completeVaultUnlock: (dek: CryptoKey, me?: MeResponse) => Promise<void>
): Promise<TokenPair> {
  const me = await fetchMe(sessionToken);
  const vaultExists = Boolean(me.vaultInitialized);
  const passwordSlot = findPasswordSlot(me.vaultSlots);
  let dek: CryptoKey | null = null;

  if (vaultExists) {
    dek = await readDEK();
    if (!dek) {
      try {
        dek = await unlockVault(password, me.vaultSlots);
        await completeVaultUnlock(dek, me);
      } catch {
        throw new Error(VAULT_UNLOCK_FAILED);
      }
    }
  }

  const pair = await patchMeWithToken(sessionToken, {
    currentPassword: password,
    newPassword: newPassword,
  });

  if (!pair) {
    throw new Error("Password change did not return a session.");
  }

  if (passwordSlot?.id && dek) {
    const wrapped = await rewrapVault(dek, newPassword);
    await updateVaultSlot(pair.sessionToken, passwordSlot.id, {
      salt: wrapped.salt,
      wrapBlob: wrapped.wrapBlob,
      password: newPassword,
    });
  }

  return pair;
}

export function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const { completeLoginWithPassword, completeVaultUnlock } = useAuth();
  const { pushNotification } = useNotifications();

  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setErrorMessages([]);
      setSubmitting(false);
    }
  }, [isOpen]);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessages([]);

    const validationError = validateChangePasswordForm(password, newPassword, confirmNewPassword);
    if (validationError) {
      setErrorMessages([validationError]);
      return;
    }

    setSubmitting(true);
    try {
      const tokens = await withSessionToken((sessionToken) =>
        changePasswordAndRewrapVault(sessionToken, password, newPassword, completeVaultUnlock)
      );
      await completeLoginWithPassword(tokens, newPassword);
      pushNotification("Password Updated", "success");
      onClose();
    } catch (error) {
      if (error instanceof Error && error.message === VAULT_UNLOCK_FAILED) {
        setErrorMessages(["Check your current password and try again."]);
        return;
      }
      if (error instanceof ApiError && error.status === 401) {
        setErrorMessages(["Current password is incorrect"]);
        return;
      }
      setErrorMessages([errorMessage(error, "Could not change your password. Please try again.")]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <StackedModalShell
      isOpen={isOpen}
      title="Change Password"
      busy={submitting}
      onClose={onClose}
      subtitle="Enter your current password and choose a new one."
      panelClassName="relative w-full max-w-md rounded-sm bg-white p-6 shadow-xl"
    >
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <FormErrorSummary messages={errorMessages} />

        <FormRow label="Current Password" htmlFor="change-password-current" required>
          <PasswordInput
            id="change-password-current"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={submitting}
            autoComplete="current-password"
          />
        </FormRow>
        <FormRow label="New Password" htmlFor="change-password-new" required>
          <PasswordInput
            encryptionKind="server_hashed"
            id="change-password-new"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            disabled={submitting}
            autoComplete="new-password"
            revealLabel="new password"
          />
        </FormRow>
        <FormRow label="Confirm Password" htmlFor="change-password-confirm" required>
          <PasswordInput
            id="change-password-confirm"
            value={confirmNewPassword}
            onChange={(event) => setConfirmNewPassword(event.target.value)}
            disabled={submitting}
            autoComplete="new-password"
            revealLabel="confirmed password"
          />
        </FormRow>

        <div className="flex justify-end gap-2">
          <SecondaryButton type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </SecondaryButton>
          <PrimaryButton type="submit" disabled={submitting} aria-busy={submitting}>
            {submitting ? "Saving…" : "Change Password"}
          </PrimaryButton>
        </div>
      </form>
    </StackedModalShell>
  );
}
