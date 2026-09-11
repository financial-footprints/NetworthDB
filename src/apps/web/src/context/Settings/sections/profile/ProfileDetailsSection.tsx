import { PrimaryButton, SecondaryButton } from "@web/components/button";
import { FormErrorSummary } from "@web/components/fields/FormErrorSummary";
import { FormRow, formRowActionsClassName } from "@web/components/fields/FormRow";
import { useAuth } from "@web/context/Auth/AuthContext";
import { EncryptionFieldShell } from "@web/context/Settings/components/encryption/EncryptionFieldShell";
import { ProfileSectionCard } from "@web/context/Settings/components/ProfileSectionCard";
import { VaultPasswordModal } from "@web/context/Settings/modals/encryption/VaultPasswordModal";
import {
  SecurityConfirmModal,
  type SecurityConfirmResult,
} from "@web/context/Settings/modals/security/SecurityConfirmModal";
import { clearRecoveryEmail } from "@web/utils/api/endpoints/auth";
import { ApiError } from "@web/utils/api/types";
import { readDEK } from "@web/utils/crypto/session";
import { errorMessage } from "@web/utils/errors";
import { type SubmitEvent, useEffect, useRef, useState } from "react";
import { FaCheckCircle } from "react-icons/fa";
import {
  applyProfileSaveFlowResult,
  handleProfileSaveError,
  resolveProfileSaveIntent,
  runProfileSaveFlow,
} from "./ProfileDetailsSection.hooks";

type SecurityModalPurpose = "save" | "recovery-remove";

export function ProfileDetailsSection() {
  const { user, updateDisplayName, applyMe, completeLoginWithPassword, completeVaultUnlock } =
    useAuth();

  const [name, setName] = useState(user?.displayName ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  const [vaultModalOpen, setVaultModalOpen] = useState(false);
  const [vaultModalErrors, setVaultModalErrors] = useState<string[]>([]);

  const [securityModalOpen, setSecurityModalOpen] = useState(false);
  const [securityModalPurpose, setSecurityModalPurpose] = useState<SecurityModalPurpose>("save");
  const [securityModalErrors, setSecurityModalErrors] = useState<string[]>([]);
  const [securityModalMfaEnabled, setSecurityModalMfaEnabled] = useState(false);
  const [securityModalPasswordRequired, setSecurityModalPasswordRequired] = useState(true);

  const [pendingVaultPassword, setPendingVaultPassword] = useState<string | undefined>();

  const saveInFlightRef = useRef(false);

  useEffect(() => {
    setUsername(user?.username ?? "");
    setName(user?.displayName ?? "");
  }, [user?.username, user?.displayName]);

  useEffect(() => {
    if (!saved) {
      return;
    }
    const timer = setTimeout(() => {
      setSaved(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, [saved]);

  function openSecurityModal(
    purpose: SecurityModalPurpose,
    options: { passwordRequired: boolean; mfaEnabled: boolean }
  ): void {
    setSecurityModalPurpose(purpose);
    setSecurityModalPasswordRequired(options.passwordRequired);
    setSecurityModalMfaEnabled(options.mfaEnabled);
    setSecurityModalErrors([]);
    setSecurityModalOpen(true);
  }

  function releaseSaveLock(): void {
    saveInFlightRef.current = false;
    setDetailsSaving(false);
  }

  async function executeProfileSave(
    vaultPassword?: string,
    security?: SecurityConfirmResult
  ): Promise<void> {
    if (!user || saveInFlightRef.current) {
      return;
    }

    saveInFlightRef.current = true;
    setDetailsSaving(true);
    setErrorMessages([]);
    setSaved(false);

    const intent = resolveProfileSaveIntent(
      user,
      name,
      username,
      recoveryEmail,
      security,
      vaultPassword
    );

    try {
      const dekInSession = await readDEK();
      const result = await runProfileSaveFlow({
        intent,
        vaultPassword,
        security,
        dekInSession,
        completeVaultUnlock,
        completeLoginWithPassword,
        updateDisplayName,
        onVaultPasswordRequired: () => {
          releaseSaveLock();
          setVaultModalErrors([]);
          setVaultModalOpen(true);
        },
        onError: setErrorMessages,
      });

      await applyProfileSaveFlowResult(result, intent, {
        onSecurityRequired: (needsMfaForRecovery) => {
          releaseSaveLock();
          openSecurityModal("save", {
            passwordRequired: true,
            mfaEnabled: needsMfaForRecovery,
          });
        },
        onMfaRequired: () => {
          releaseSaveLock();
          openSecurityModal("save", { passwordRequired: false, mfaEnabled: true });
        },
        onSaved: async (recoveryMe) => {
          if (recoveryMe) {
            setRecoveryEmail("");
            await applyMe(recoveryMe);
          }
          setSaved(true);
        },
      });
    } catch (error) {
      handleProfileSaveError(error, intent, vaultPassword, {
        onVaultError: (message) => {
          releaseSaveLock();
          setVaultModalErrors([message]);
          setVaultModalOpen(true);
        },
        onSecurityError: (message, needsMfaForRecovery) => {
          releaseSaveLock();
          openSecurityModal("save", {
            passwordRequired: true,
            mfaEnabled: needsMfaForRecovery,
          });
          setSecurityModalErrors([message]);
        },
        onFormError: (message) => {
          setErrorMessages([message]);
        },
      });
    } finally {
      saveInFlightRef.current = false;
      setDetailsSaving(false);
    }
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessages([]);
    setSaved(false);

    if (!user) {
      return;
    }

    const intent = resolveProfileSaveIntent(user, name, username, recoveryEmail);

    if (!intent.usernameChanged && !intent.nameChanged && !intent.wantsRecovery) {
      setErrorMessages(["No changes to save."]);
      return;
    }

    setPendingVaultPassword(undefined);
    await executeProfileSave(undefined, undefined);
  }

  async function handleVaultModalConfirm(password: string) {
    setVaultModalErrors([]);
    setPendingVaultPassword(password);
    setVaultModalOpen(false);
    await executeProfileSave(password, undefined);
  }

  async function handleSecurityModalConfirm(result: SecurityConfirmResult) {
    setSecurityModalErrors([]);

    if (securityModalPurpose === "recovery-remove") {
      setDetailsSaving(true);
      setSecurityModalErrors([]);
      try {
        const me = await clearRecoveryEmail({
          current_password: result.password,
        });
        await applyMe(me);
        setSecurityModalOpen(false);
        setSaved(true);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          setSecurityModalMfaEnabled(user?.multifactor_enabled ?? false);
          setSecurityModalErrors(["Password or MFA verification failed."]);
        } else {
          setSecurityModalErrors([errorMessage(error, "Could not clear recovery email.")]);
        }
      } finally {
        setDetailsSaving(false);
      }
      return;
    }

    setSecurityModalOpen(false);
    await executeProfileSave(pendingVaultPassword, result);
  }

  function openRecoveryRemoveModal() {
    openSecurityModal("recovery-remove", {
      passwordRequired: true,
      mfaEnabled: user?.multifactor_enabled ?? false,
    });
  }

  const securityModalTitle =
    securityModalPurpose === "recovery-remove" ? "Clear recovery email" : "Confirm changes";

  const securityModalDescription =
    securityModalPurpose === "save"
      ? "Enter your current password to save username or recovery email changes."
      : securityModalPurpose === "recovery-remove"
        ? "Confirm your password to remove the enrolled recovery email."
        : undefined;

  if (!user) {
    return null;
  }

  return (
    <>
      <ProfileSectionCard
        title="Details"
        description="You may need to re-enter your password to save some changes."
      >
        <form id="profile-details-form" className="space-y-4" onSubmit={handleSubmit} noValidate>
          <FormErrorSummary messages={errorMessages} />

          <FormRow
            label="Name"
            htmlFor="profile-name"
            infoAriaLabel="About name"
            info={<p className="font-medium text-slate-800">This field is optional.</p>}
          >
            <EncryptionFieldShell kind="e2ee">
              <input
                id="profile-name"
                type="text"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setSaved(false);
                }}
                disabled={detailsSaving}
                className="form-input-inner"
                autoComplete="name"
              />
            </EncryptionFieldShell>
          </FormRow>

          <FormRow
            label="Username"
            htmlFor="profile-username"
            infoAriaLabel="About username"
            info={
              <>
                <p className="font-medium text-slate-800">This field is required.</p>
                <p>Your sign-in username.</p>
              </>
            }
          >
            <EncryptionFieldShell kind="server_plain">
              <input
                id="profile-username"
                type="text"
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value);
                  setSaved(false);
                }}
                disabled={detailsSaving}
                className="form-input-inner"
                autoComplete="username"
              />
            </EncryptionFieldShell>
          </FormRow>

          <FormRow
            label="Recovery Email"
            htmlFor="profile-recovery-email"
            infoAriaLabel="About recovery email"
            info={<p className="font-medium text-slate-800">This field is optional.</p>}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <EncryptionFieldShell
                kind="server_hashed"
                leading={
                  <span
                    className={`shrink-0 border-r border-slate-200 px-3 py-2 text-xs font-medium ${
                      user.recovery_email_enabled ? "text-green-700" : "text-red-600"
                    }`}
                  >
                    {user.recovery_email_enabled ? "Enrolled" : "Unenrolled"}
                  </span>
                }
              >
                <input
                  id="profile-recovery-email"
                  type="email"
                  value={recoveryEmail}
                  onChange={(event) => {
                    setRecoveryEmail(event.target.value);
                    setSaved(false);
                  }}
                  disabled={detailsSaving}
                  placeholder={
                    user.recovery_email_enabled
                      ? "New address to replace enrolled email"
                      : "you@example.com"
                  }
                  className="form-input-inner"
                  autoComplete="email"
                />
              </EncryptionFieldShell>
              {user.recovery_email_enabled ? (
                <SecondaryButton
                  type="button"
                  disabled={detailsSaving}
                  onClick={openRecoveryRemoveModal}
                >
                  Clear
                </SecondaryButton>
              ) : null}
            </div>
          </FormRow>

          <div className={`${formRowActionsClassName} justify-end`}>
            {saved ? (
              <p className="inline-flex items-center gap-1.5 text-sm text-green-700">
                <FaCheckCircle aria-hidden className="h-4 w-4" />
                Saved
              </p>
            ) : null}
            <PrimaryButton
              type="submit"
              disabled={detailsSaving || vaultModalOpen}
              aria-busy={detailsSaving}
            >
              {detailsSaving ? "Saving…" : "Save"}
            </PrimaryButton>
          </div>
        </form>
      </ProfileSectionCard>

      <VaultPasswordModal
        isOpen={vaultModalOpen}
        mode="unlock"
        submitting={detailsSaving}
        errorMessages={vaultModalErrors}
        onClose={() => {
          if (!detailsSaving) {
            setVaultModalOpen(false);
          }
        }}
        onConfirm={(password) => {
          void handleVaultModalConfirm(password);
        }}
      />

      <SecurityConfirmModal
        isOpen={securityModalOpen}
        title={securityModalTitle}
        description={securityModalDescription}
        mfaEnabled={securityModalMfaEnabled}
        passwordRequired={securityModalPasswordRequired}
        pendingPassword={pendingVaultPassword}
        confirmLabel={securityModalPurpose === "recovery-remove" ? "Clear" : undefined}
        submitting={detailsSaving}
        errorMessages={securityModalErrors}
        onClose={() => {
          if (!detailsSaving) {
            setSecurityModalOpen(false);
          }
        }}
        onConfirm={(result) => {
          void handleSecurityModalConfirm(result);
        }}
      />
    </>
  );
}
