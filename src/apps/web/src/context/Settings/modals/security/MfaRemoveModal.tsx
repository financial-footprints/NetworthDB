import { AUTHENTICATOR_METHOD_LABEL, mapMfaRemoveError } from "@web/components/auth/helper";
import { MfaProofCollector } from "@web/components/auth/MfaProofCollector";
import { CalloutSummary } from "@web/components/badge/CalloutSummary";
import { FormErrorSummary } from "@web/components/fields/FormErrorSummary";
import { StackedModalShell } from "@web/context/Settings/components/StackedModalShell";
import {
  deleteWebAuthnCredential,
  recoveryClear,
  totpDisable,
  withSessionToken,
} from "@web/utils/api/endpoints/auth";
import type { MfaProofPayload } from "@web/utils/api/endpoints/auth/mfa";
import type { AuthUser } from "@web/utils/api/endpoints/auth/types";
import { useEffect, useState } from "react";

type MfaRemoveTarget = "totp" | "passkey" | "recovery";

type MfaRemoveModalProps = {
  isOpen: boolean;
  target: MfaRemoveTarget;
  passkeyId?: string;
  passkeyName?: string;
  user: AuthUser;
  onClose: () => void;
  onComplete: () => void;
};

function mfaRemoveTitle(target: MfaRemoveTarget): string {
  if (target === "totp") {
    return `Remove ${AUTHENTICATOR_METHOD_LABEL}`;
  }
  if (target === "recovery") {
    return "Remove Recovery Codes";
  }
  return "Remove passkey";
}

function mfaRemoveConfirmMessage(target: MfaRemoveTarget, passkeyName?: string): string {
  const warning =
    target === "totp"
      ? "Your authenticator will be removed. Codes from your authenticator will no longer work for sign-in."
      : target === "recovery"
        ? "Your recovery codes will be removed. Unused codes will no longer work for sign-in."
        : `Passkey "${passkeyName || "Passkey"}" will be removed and can no longer be used to sign in.`;
  return `${warning} You will be signed out and need to sign in again.`;
}

async function removeMfaTarget(
  sessionToken: string,
  target: MfaRemoveTarget,
  passkeyId: string | undefined,
  proof: MfaProofPayload
): Promise<void> {
  if (target === "totp") {
    await totpDisable(sessionToken, proof);
    return;
  }
  if (target === "recovery") {
    await recoveryClear(sessionToken, proof);
    return;
  }
  if (!passkeyId) {
    throw new Error("Passkey id is required.");
  }
  await deleteWebAuthnCredential(sessionToken, passkeyId, proof);
}

export function MfaRemoveModal({
  isOpen,
  target,
  passkeyId,
  passkeyName,
  user,
  onClose,
  onComplete,
}: MfaRemoveModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setSubmitting(false);
    setPasskeyBusy(false);
    setErrorMessages([]);
  }, [isOpen]);

  const busy = submitting || passkeyBusy;

  async function handleConfirmRemove(nextProof: MfaProofPayload) {
    setErrorMessages([]);
    setSubmitting(true);
    try {
      await withSessionToken((sessionToken) =>
        removeMfaTarget(sessionToken, target, passkeyId, nextProof)
      );
      onComplete();
    } catch (error) {
      setErrorMessages([mapMfaRemoveError(error, target)]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <StackedModalShell
      isOpen={isOpen}
      title={mfaRemoveTitle(target)}
      subtitle="This action cannot be undone."
      busy={busy}
      onClose={onClose}
      panelClassName="relative max-h-[min(90vh,720px)] w-full max-w-md overflow-y-auto rounded-sm bg-white p-5 shadow-xl"
    >
      <div className="space-y-4">
        <FormErrorSummary messages={errorMessages} />

        <MfaProofCollector
          user={user}
          {...(target === "recovery" ? { includeRecoveryCode: false } : {})}
          disabled={busy}
          submitLabel={submitting ? "Removing…" : "Remove"}
          submitTone="danger"
          onCancel={onClose}
          onBusyChange={setPasskeyBusy}
          footer={
            <CalloutSummary variant="warning">
              <p>{mfaRemoveConfirmMessage(target, passkeyName)}</p>
            </CalloutSummary>
          }
          onProofReady={(nextProof) => {
            void handleConfirmRemove(nextProof);
          }}
        />
      </div>
    </StackedModalShell>
  );
}
