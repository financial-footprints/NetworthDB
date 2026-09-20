import { PrimaryButton, SecondaryButton } from "@web/components/Button";
import { FormErrorSummary } from "@web/components/Fields/FormErrorSummary";
import { FormRow, formRowActionsClassName } from "@web/components/Fields/FormRow";
import { useAuth } from "@web/contexts/Auth/Context";
import { Card } from "@web/contexts/Settings/components/Card";
import { Shell } from "@web/contexts/Settings/components/encryption/Shell";
import { VaultPasswordModal } from "@web/contexts/Settings/modals/encryption/VaultPasswordModal";
import {
  Confirm,
  type SecurityConfirmResult,
} from "@web/contexts/Settings/modals/security/Confirm";
import {
  confirmProfileRecoveryEmailClear,
  executeProfileDetailsSave,
  resolveProfileSaveIntent,
} from "@web/contexts/Settings/sections/profile/save";
import { useE2eeFieldEnabled } from "@web/utils/crypto/field";
import { type SubmitEvent, useEffect, useRef, useState } from "react";
import { FaCheckCircle } from "react-icons/fa";

type SecurityModalPurpose = "save" | "recovery-remove";

function securityModalCopy(purpose: SecurityModalPurpose): {
  title: string;
  description?: string;
  confirmLabel?: string;
} {
  if (purpose === "recovery-remove") {
    return {
      title: "Clear recovery email",
      description: "Confirm your password to remove the enrolled recovery email.",
      confirmLabel: "Clear",
    };
  }
  return {
    title: "Confirm changes",
    description: "Enter your current password to save username or recovery email changes.",
  };
}

export function Details() {
  const { user, updateDisplayName, applyMe, completeLoginWithPassword, completeVaultUnlock } =
    useAuth();
  const e2eeNameEnabled = useE2eeFieldEnabled("display_name");

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
    if (!user) {
      return;
    }
    await executeProfileDetailsSave(
      {
        user,
        name,
        username,
        recoveryEmail,
        e2eeNameEnabled,
        saveInFlightRef,
        completeVaultUnlock,
        completeLoginWithPassword,
        updateDisplayName,
        applyMe,
        releaseSaveLock,
        setDetailsSaving,
        setErrorMessages,
        setSaved,
        setVaultModalErrors,
        setVaultModalOpen,
        openSecurityModal,
        setSecurityModalErrors,
        setRecoveryEmailField: setRecoveryEmail,
      },
      vaultPassword,
      security
    );
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
      await confirmProfileRecoveryEmailClear({
        result,
        user,
        applyMe,
        setDetailsSaving,
        setSecurityModalMfaEnabled,
        setSecurityModalErrors,
        setSecurityModalOpen,
        setSaved,
      });
      return;
    }

    setSecurityModalOpen(false);
    await executeProfileSave(pendingVaultPassword, result);
  }

  function openRecoveryRemoveModal() {
    openSecurityModal("recovery-remove", {
      passwordRequired: true,
      mfaEnabled: user?.multifactorEnabled ?? false,
    });
  }

  const securityModal = securityModalCopy(securityModalPurpose);

  if (!user) {
    return null;
  }

  return (
    <>
      <Card
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
            <Shell kind={e2eeNameEnabled ? "e2ee" : "server_plain"}>
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
            </Shell>
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
            <Shell kind="server_plain">
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
            </Shell>
          </FormRow>

          <FormRow
            label="Recovery Email"
            htmlFor="profile-recovery-email"
            infoAriaLabel="About recovery email"
            info={<p className="font-medium text-slate-800">This field is optional.</p>}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Shell
                kind="server_hashed"
                leading={
                  <span
                    className={`shrink-0 border-r border-slate-200 px-3 py-2 text-xs font-medium ${
                      user.recoveryEmailEnabled ? "text-green-700" : "text-red-600"
                    }`}
                  >
                    {user.recoveryEmailEnabled ? "Enrolled" : "Unenrolled"}
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
                    user.recoveryEmailEnabled
                      ? "New address to replace enrolled email"
                      : "you@example.com"
                  }
                  className="form-input-inner"
                  autoComplete="email"
                />
              </Shell>
              {user.recoveryEmailEnabled ? (
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
      </Card>

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

      <Confirm
        isOpen={securityModalOpen}
        title={securityModal.title}
        description={securityModal.description}
        mfaEnabled={securityModalMfaEnabled}
        passwordRequired={securityModalPasswordRequired}
        pendingPassword={pendingVaultPassword}
        confirmLabel={securityModal.confirmLabel}
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
