import { formatMfaMethodLabel, type MfaEnrollMethod } from "@web/components/Auth/helpers";
import { CalloutSummary } from "@web/components/Badge/CalloutSummary";
import { DangerButton, SecondaryButton } from "@web/components/Button";
import { Hover } from "@web/components/Popover/Hover";
import { useAuth } from "@web/contexts/Auth/Context";
import { Card } from "@web/contexts/Settings/components/Card";
import { ChangePasswordModal } from "@web/contexts/Settings/modals/security/ChangePasswordModal";
import { MfaEnrollModal } from "@web/contexts/Settings/modals/security/MfaEnrollModal";
import { MfaRemoveModal } from "@web/contexts/Settings/modals/security/MfaRemoveModal";
import { RecoveryCodesGenerateModal } from "@web/contexts/Settings/modals/security/RecoveryCodesGenerateModal";
import { listWebAuthnCredentials, withSessionToken } from "@web/utils/api/routes/auth";
import type { WebAuthnCredential } from "@web/utils/api/routes/auth/mfa";
import type { AuthUser, TokenPair } from "@web/utils/api/routes/auth/types";
import { errorMessage } from "@web/utils/errors";
import { formatDateOnly } from "@web/utils/time";
import { useCallback, useEffect, useState } from "react";

type ProfileSecuritySectionProps = {
  onMfaEnrollmentComplete: (tokens: TokenPair | null) => void | Promise<void>;
  onMfaRemovalComplete: () => void;
  onRecoveryCodesGenerated: () => void;
};

type RemoveTarget =
  | { kind: "totp" }
  | { kind: "recovery" }
  | { kind: "passkey"; id: string; name: string };

type TotpFactorRowProps = {
  onRemove: () => void;
};

function TotpFactorRow({ onRemove }: TotpFactorRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-sm border border-slate-200 bg-white px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-sm text-slate-800">{formatMfaMethodLabel("totp")}</span>
        <Hover ariaLabel="About authenticator">
          You can add this secret to multiple devices by scanning the same QR code.
        </Hover>
      </div>
      <DangerButton onClick={onRemove}>Remove</DangerButton>
    </div>
  );
}

type PasskeyFactorListProps = {
  passkeys: WebAuthnCredential[];
  passkeysLoading: boolean;
  passkeysError: string | null;
  onRemove: (id: string, name: string) => void;
};

function PasskeyFactorList({
  passkeys,
  passkeysLoading,
  passkeysError,
  onRemove,
}: PasskeyFactorListProps) {
  return (
    <>
      {passkeysLoading ? (
        <p className="text-sm text-slate-500" aria-busy="true">
          Loading passkeys…
        </p>
      ) : null}

      {passkeysError ? (
        <p className="text-sm text-red-700" role="alert">
          {passkeysError}
        </p>
      ) : null}

      {passkeys.map((passkey) => (
        <div
          key={passkey.id}
          className="flex items-center justify-between gap-3 rounded-sm border border-slate-200 bg-white px-3 py-2"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-800">
              {passkey.name || "Passkey"}
            </p>
            <p className="text-xs text-slate-500">Added {formatDateOnly(passkey.createdAt)}</p>
          </div>
          <DangerButton onClick={() => onRemove(passkey.id, passkey.name || "Passkey")}>
            Remove
          </DangerButton>
        </div>
      ))}
    </>
  );
}

type RecoveryFactorRowProps = {
  showInactiveRecovery: boolean;
  onRemove: () => void;
};

function RecoveryFactorRow({ showInactiveRecovery, onRemove }: RecoveryFactorRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-sm border border-slate-200 bg-white px-3 py-2">
      <div className="min-w-0 space-y-0.5">
        <span className="text-sm text-slate-800">{formatMfaMethodLabel("recovery")}</span>
        {showInactiveRecovery ? (
          <p className="text-xs text-slate-500">
            Enrolled on the server but inactive without a primary MFA method. Remove these codes or
            add an authenticator or passkey.
          </p>
        ) : null}
      </div>
      <DangerButton onClick={onRemove}>Remove</DangerButton>
    </div>
  );
}

type MfaEnrollmentActionsProps = {
  user: AuthUser;
  hasTotp: boolean;
  hasRecovery: boolean;
  canAddPasskey: boolean;
  onEnroll: (method: MfaEnrollMethod) => void;
  onRecoveryCodes: (mode: "generate" | "regenerate") => void;
};

function MfaEnrollmentActions({
  user,
  hasTotp,
  hasRecovery,
  canAddPasskey,
  onEnroll,
  onRecoveryCodes,
}: MfaEnrollmentActionsProps) {
  const canEnrollTotp = !hasTotp;
  const canReplaceTotp = hasTotp && user.multifactorEnabled === true;

  return (
    <div className="flex flex-wrap gap-2">
      {canEnrollTotp ? (
        <SecondaryButton type="button" onClick={() => onEnroll("totp")}>
          {`Set Up ${formatMfaMethodLabel("totp")}`}
        </SecondaryButton>
      ) : null}

      {canReplaceTotp ? (
        <SecondaryButton type="button" onClick={() => onEnroll("totp")}>
          {`Replace ${formatMfaMethodLabel("totp")}`}
        </SecondaryButton>
      ) : null}

      {canAddPasskey || !user.multifactorEnabled ? (
        <SecondaryButton type="button" onClick={() => onEnroll("webauthn")}>
          Add Passkey
        </SecondaryButton>
      ) : null}

      {user.multifactorEnabled && !hasRecovery ? (
        <SecondaryButton type="button" onClick={() => onRecoveryCodes("generate")}>
          Generate Recovery Codes
        </SecondaryButton>
      ) : null}

      {user.multifactorEnabled && hasRecovery ? (
        <SecondaryButton type="button" onClick={() => onRecoveryCodes("regenerate")}>
          Regenerate Recovery Codes
        </SecondaryButton>
      ) : null}
    </div>
  );
}

type MfaFactorsPanelProps = {
  user: AuthUser;
  hasTotp: boolean;
  hasRecovery: boolean;
  hasEnrolledFactors: boolean;
  showRecovery: boolean;
  showInactiveRecovery: boolean;
  canAddPasskey: boolean;
  passkeys: WebAuthnCredential[];
  passkeysLoading: boolean;
  passkeysError: string | null;
  onRemoveTotp: () => void;
  onRemovePasskey: (id: string, name: string) => void;
  onRemoveRecovery: () => void;
  onEnroll: (method: MfaEnrollMethod) => void;
  onRecoveryCodes: (mode: "generate" | "regenerate") => void;
};

function MfaFactorsPanel({
  user,
  hasTotp,
  hasRecovery,
  hasEnrolledFactors,
  showRecovery,
  showInactiveRecovery,
  canAddPasskey,
  passkeys,
  passkeysLoading,
  passkeysError,
  onRemoveTotp,
  onRemovePasskey,
  onRemoveRecovery,
  onEnroll,
  onRecoveryCodes,
}: MfaFactorsPanelProps) {
  return (
    <div className="space-y-4 border-t border-slate-100 pt-6">
      <p className="text-sm font-medium text-slate-900">Multi-factor authentication</p>

      {!user.multifactorEnabled && !hasEnrolledFactors ? (
        <CalloutSummary variant="warning">
          <p className="font-medium">Enable Multi-factor Authentication</p>
          <p className="mt-0.5">Add passkey or authenticator as a second sign-in step.</p>
        </CalloutSummary>
      ) : null}

      {hasTotp ? <TotpFactorRow onRemove={onRemoveTotp} /> : null}

      <PasskeyFactorList
        passkeys={passkeys}
        passkeysLoading={passkeysLoading}
        passkeysError={passkeysError}
        onRemove={onRemovePasskey}
      />

      {showRecovery ? (
        <RecoveryFactorRow
          showInactiveRecovery={showInactiveRecovery}
          onRemove={onRemoveRecovery}
        />
      ) : null}

      {user.multifactorEnabled && !hasRecovery ? (
        <p className="text-sm text-slate-500">
          Recovery codes let you sign in if you lose access to your other MFA methods. Generate a
          set and store them offline.
        </p>
      ) : null}

      <MfaEnrollmentActions
        user={user}
        hasTotp={hasTotp}
        hasRecovery={hasRecovery}
        canAddPasskey={canAddPasskey}
        onEnroll={onEnroll}
        onRecoveryCodes={onRecoveryCodes}
      />
    </div>
  );
}

type SecurityModalsProps = {
  user: AuthUser;
  hasTotp: boolean;
  changePasswordOpen: boolean;
  enrollModalMethod: MfaEnrollMethod | null;
  removeTarget: RemoveTarget | null;
  recoveryCodesModalMode: "generate" | "regenerate" | null;
  getMfaBearerToken: () => Promise<string>;
  onChangePasswordClose: () => void;
  onEnrollClose: () => void;
  onEnrollComplete: (tokens: TokenPair | null) => void;
  onRemoveClose: () => void;
  onRemoveComplete: () => void;
  onRecoveryCodesClose: () => void;
  onRecoveryCodesComplete: () => void;
};

function SecurityModals({
  user,
  hasTotp,
  changePasswordOpen,
  enrollModalMethod,
  removeTarget,
  recoveryCodesModalMode,
  getMfaBearerToken,
  onChangePasswordClose,
  onEnrollClose,
  onEnrollComplete,
  onRemoveClose,
  onRemoveComplete,
  onRecoveryCodesClose,
  onRecoveryCodesComplete,
}: SecurityModalsProps) {
  return (
    <>
      <ChangePasswordModal isOpen={changePasswordOpen} onClose={onChangePasswordClose} />

      <MfaEnrollModal
        isOpen={enrollModalMethod !== null}
        method={enrollModalMethod ?? "totp"}
        getBearerToken={getMfaBearerToken}
        mode={enrollModalMethod === "totp" && hasTotp ? "replace" : "enroll"}
        user={user}
        onClose={onEnrollClose}
        onComplete={onEnrollComplete}
      />

      <MfaRemoveModal
        isOpen={removeTarget !== null}
        target={removeTarget?.kind ?? "totp"}
        passkeyId={removeTarget?.kind === "passkey" ? removeTarget.id : undefined}
        passkeyName={removeTarget?.kind === "passkey" ? removeTarget.name : undefined}
        user={user}
        onClose={onRemoveClose}
        onComplete={onRemoveComplete}
      />

      <RecoveryCodesGenerateModal
        isOpen={recoveryCodesModalMode !== null}
        mode={recoveryCodesModalMode ?? "generate"}
        user={user}
        onClose={onRecoveryCodesClose}
        onComplete={onRecoveryCodesComplete}
      />
    </>
  );
}

export function Security({
  onMfaEnrollmentComplete,
  onMfaRemovalComplete,
  onRecoveryCodesGenerated,
}: ProfileSecuritySectionProps) {
  const { user } = useAuth();
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [passkeys, setPasskeys] = useState<WebAuthnCredential[]>([]);
  const [passkeysLoading, setPasskeysLoading] = useState(false);
  const [passkeysError, setPasskeysError] = useState<string | null>(null);
  const [enrollModalMethod, setEnrollModalMethod] = useState<MfaEnrollMethod | null>(null);
  const [removeTarget, setRemoveTarget] = useState<RemoveTarget | null>(null);
  const [recoveryCodesModalMode, setRecoveryCodesModalMode] = useState<
    "generate" | "regenerate" | null
  >(null);

  const shouldLoadPasskeys = user?.multifactorEnabled === true;

  const loadPasskeys = useCallback(async () => {
    if (!user?.multifactorEnabled) {
      setPasskeys([]);
      return;
    }

    setPasskeysLoading(true);
    setPasskeysError(null);
    try {
      const response = await withSessionToken((sessionToken) =>
        listWebAuthnCredentials(sessionToken)
      );
      setPasskeys(response.items);
    } catch (error) {
      setPasskeys([]);
      setPasskeysError(errorMessage(error, "Could not load registered passkeys."));
    } finally {
      setPasskeysLoading(false);
    }
  }, [user?.multifactorEnabled]);

  useEffect(() => {
    if (!shouldLoadPasskeys) {
      setPasskeys([]);
      setPasskeysError(null);
      return;
    }
    void loadPasskeys();
  }, [loadPasskeys, shouldLoadPasskeys]);

  const getMfaBearerToken = useCallback(
    (): Promise<string> => withSessionToken(async (sessionToken) => sessionToken),
    []
  );

  const hasTotp = user?.multifactorMethods.includes("totp") ?? false;
  const hasRecovery =
    user?.recoveryCodesEnabled === true || user?.multifactorMethods.includes("recovery") === true;
  const hasPrimaryMfaFactor = hasTotp || passkeys.length > 0;
  const showRecovery = hasRecovery;
  const showInactiveRecovery = hasRecovery && !hasPrimaryMfaFactor;
  const hasEnrolledFactors =
    hasTotp || passkeys.length > 0 || hasRecovery || user?.multifactorEnabled === true;
  const canAddPasskey = user?.multifactorEnabled === true && !passkeysLoading;

  return (
    <>
      <Card title="Security">
        <div className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-slate-900">Password</p>
            </div>
            <SecondaryButton type="button" onClick={() => setChangePasswordOpen(true)}>
              Change Password
            </SecondaryButton>
          </div>

          {user ? (
            <MfaFactorsPanel
              user={user}
              hasTotp={hasTotp}
              hasRecovery={hasRecovery}
              hasEnrolledFactors={hasEnrolledFactors}
              showRecovery={showRecovery}
              showInactiveRecovery={showInactiveRecovery}
              canAddPasskey={canAddPasskey}
              passkeys={passkeys}
              passkeysLoading={passkeysLoading}
              passkeysError={passkeysError}
              onRemoveTotp={() => setRemoveTarget({ kind: "totp" })}
              onRemovePasskey={(id, name) => setRemoveTarget({ kind: "passkey", id, name })}
              onRemoveRecovery={() => setRemoveTarget({ kind: "recovery" })}
              onEnroll={setEnrollModalMethod}
              onRecoveryCodes={setRecoveryCodesModalMode}
            />
          ) : null}
        </div>
      </Card>

      {user ? (
        <SecurityModals
          user={user}
          hasTotp={hasTotp}
          changePasswordOpen={changePasswordOpen}
          enrollModalMethod={enrollModalMethod}
          removeTarget={removeTarget}
          recoveryCodesModalMode={recoveryCodesModalMode}
          getMfaBearerToken={getMfaBearerToken}
          onChangePasswordClose={() => setChangePasswordOpen(false)}
          onEnrollClose={() => setEnrollModalMethod(null)}
          onEnrollComplete={(tokens) => {
            setEnrollModalMethod(null);
            void Promise.resolve(onMfaEnrollmentComplete(tokens)).then(() => {
              void loadPasskeys();
            });
          }}
          onRemoveClose={() => setRemoveTarget(null)}
          onRemoveComplete={() => {
            setRemoveTarget(null);
            onMfaRemovalComplete();
          }}
          onRecoveryCodesClose={() => setRecoveryCodesModalMode(null)}
          onRecoveryCodesComplete={() => {
            setRecoveryCodesModalMode(null);
            onRecoveryCodesGenerated();
          }}
        />
      ) : null}
    </>
  );
}
