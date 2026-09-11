import { type MfaProofMethod, mfaProofRequiredMessage } from "@web/components/auth/helper";
import { MfaProofCollector } from "@web/components/auth/MfaProofCollector";
import { RecoveryCodesDisplay } from "@web/components/auth/RecoveryCodesDisplay";
import { PrimaryButton, SecondaryButton } from "@web/components/button";
import { FormErrorSummary } from "@web/components/fields/FormErrorSummary";
import { StackedModalShell } from "@web/context/Settings/components/StackedModalShell";
import { recoveryGenerate, withSessionToken } from "@web/utils/api/endpoints/auth";
import type { MfaProofPayload } from "@web/utils/api/endpoints/auth/mfa";
import type { AuthUser } from "@web/utils/api/endpoints/auth/types";
import { ApiError } from "@web/utils/api/types";
import { errorMessage } from "@web/utils/errors";
import { type SubmitEvent, useCallback, useEffect, useRef, useState } from "react";

type RecoveryCodesGenerateModalProps = {
  isOpen: boolean;
  mode: "generate" | "regenerate";
  user: AuthUser;
  onClose: () => void;
  onComplete: () => void;
};

type Step = "confirm" | "display";

export function RecoveryCodesGenerateModal({
  isOpen,
  mode,
  user,
  onClose,
  onComplete,
}: RecoveryCodesGenerateModalProps) {
  const [step, setStep] = useState<Step>("confirm");
  const [mfaProof, setMfaProof] = useState<MfaProofPayload | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const generatingRef = useRef(false);

  const title = mode === "generate" ? "Generate Recovery Codes" : "Regenerate Recovery Codes";

  const confirmDescription =
    mode === "generate"
      ? "Verify your identity to create recovery codes."
      : "Verify your identity. Existing recovery codes will stop working.";

  const displayDescription = "These codes are shown only once. Store them offline in a safe place.";

  const allowedMethods: MfaProofMethod[] =
    mode === "regenerate" ? ["totp", "recovery", "webauthn"] : ["totp", "webauthn"];

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setStep("confirm");
    setMfaProof(null);
    setCodes([]);
    setSubmitting(false);
    setPasskeyBusy(false);
    setErrorMessages([]);
    generatingRef.current = false;
  }, [isOpen]);

  const busy = submitting || passkeyBusy;

  const generateWithProof = useCallback(
    async (proof: MfaProofPayload) => {
      if (generatingRef.current) {
        return;
      }

      if (proof.recovery_code && mode !== "regenerate") {
        setErrorMessages(["Recovery codes cannot be used when generating for the first time."]);
        return;
      }

      generatingRef.current = true;
      setErrorMessages([]);
      setSubmitting(true);
      try {
        const response = await withSessionToken((sessionToken) =>
          recoveryGenerate(sessionToken, {
            totp: proof.totp,
            recovery_code: proof.recovery_code,
            webauthn_session_id: proof.webauthn_session_id,
            webauthn_response: proof.webauthn_response,
          })
        );
        setCodes(response.recovery_codes);
        setStep("display");
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          setErrorMessages(["MFA verification failed. Please try again."]);
          return;
        }
        setErrorMessages([
          errorMessage(error, "Could not generate recovery codes. Please try again."),
        ]);
      } finally {
        generatingRef.current = false;
        setSubmitting(false);
      }
    },
    [mode]
  );

  async function handleConfirmSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessages([]);

    if (!mfaProof) {
      setErrorMessages([mfaProofRequiredMessage(user.multifactor_methods.includes("webauthn"))]);
      return;
    }

    await generateWithProof(mfaProof);
  }

  return (
    <StackedModalShell
      isOpen={isOpen}
      title={title}
      description={step === "confirm" ? confirmDescription : displayDescription}
      busy={busy}
      onClose={onClose}
      panelClassName="relative max-h-[min(90vh,720px)] w-full max-w-md overflow-y-auto rounded-sm bg-white p-5 shadow-xl"
    >
      {step === "confirm" ? (
        <form className="space-y-4" onSubmit={handleConfirmSubmit} noValidate>
          <FormErrorSummary messages={errorMessages} />

          <MfaProofCollector
            user={user}
            mode="fields"
            passkeyMode="immediate"
            allowedMethods={allowedMethods}
            includeRecoveryCode={mode === "regenerate"}
            disabled={busy}
            onProofReady={(proof) => {
              void generateWithProof(proof);
            }}
            onProofChange={setMfaProof}
            onBusyChange={setPasskeyBusy}
          />

          <div className="flex justify-end gap-2">
            <SecondaryButton type="button" onClick={onClose} disabled={busy}>
              Cancel
            </SecondaryButton>
            <PrimaryButton type="submit" disabled={busy} aria-busy={submitting}>
              {submitting
                ? mode === "generate"
                  ? "Generating…"
                  : "Regenerating…"
                : mode === "generate"
                  ? "Generate codes"
                  : "Regenerate codes"}
            </PrimaryButton>
          </div>
        </form>
      ) : (
        <RecoveryCodesDisplay codes={codes} onComplete={onComplete} />
      )}
    </StackedModalShell>
  );
}
