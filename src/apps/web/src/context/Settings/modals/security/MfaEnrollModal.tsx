import {
  AUTHENTICATOR_METHOD_LABEL,
  type MfaEnrollMethod,
  mapStepUpAuthError,
  mfaProofRequiredMessage,
} from "@web/components/auth/helper";
import { MfaProofCollector } from "@web/components/auth/MfaProofCollector";
import { TotpEnrollPanel } from "@web/components/auth/TOTPEnrollPanel";
import { WebAuthnEnrollPanel } from "@web/components/auth/WebAuthnEnrollPanel";
import { CalloutSummary } from "@web/components/badge/CalloutSummary";
import { PrimaryButton, SecondaryButton } from "@web/components/button";
import { FormErrorSummary } from "@web/components/fields/FormErrorSummary";
import { FormRow } from "@web/components/fields/FormRow";
import { PasswordInput } from "@web/components/fields/PasswordInput";
import { StackedModalShell } from "@web/context/Settings/components/StackedModalShell";
import { totpBegin } from "@web/utils/api/endpoints/auth";
import type { MfaProofPayload } from "@web/utils/api/endpoints/auth/mfa";
import type { AuthUser, TokenPair } from "@web/utils/api/endpoints/auth/types";
import { type SubmitEvent, useCallback, useEffect, useState } from "react";

type MfaEnrollModalProps = {
  isOpen: boolean;
  method: MfaEnrollMethod;
  getBearerToken: () => Promise<string>;
  onClose: () => void;
  onComplete: (tokens: TokenPair | null) => void;
  mode?: "enroll" | "replace";
  user: AuthUser;
};

function mfaEnrollTitle(method: MfaEnrollMethod, mode: "enroll" | "replace"): string {
  if (method === "totp") {
    return mode === "replace"
      ? `Replace ${AUTHENTICATOR_METHOD_LABEL}`
      : `Set Up ${AUTHENTICATOR_METHOD_LABEL}`;
  }
  return "Add Passkey";
}

function mfaEnrollHelpText(
  method: MfaEnrollMethod,
  mode: "enroll" | "replace",
  totpReady: boolean,
  mfaEnabled: boolean
): string {
  if (totpReady) {
    return mode === "replace"
      ? "Scan the new QR code with your authenticator, or enter the secret key manually. Enter the verification code from that new entry — not from your previous authenticator."
      : "Scan the QR code with your authenticator, or enter the secret key manually. Then enter the verification code.";
  }
  if (method === "totp") {
    return mfaEnabled
      ? "Verify your identity, then scan the QR code to set up your authenticator."
      : "Enter your password to start authenticator setup.";
  }
  return mfaEnabled
    ? "Verify your identity, name this passkey, then register using your device biometrics, PIN, or security key."
    : "Enter your password and a name for this passkey, then register using your device biometrics, PIN, or security key.";
}

type TotpPasswordStepProps = {
  password: string;
  busy: boolean;
  errorMessages: string[];
  onPasswordChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
};

function TotpPasswordStep({
  password,
  busy,
  errorMessages,
  onPasswordChange,
  onClose,
  onSubmit,
}: TotpPasswordStepProps) {
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        void onSubmit(event);
      }}
      noValidate
    >
      <FormErrorSummary messages={errorMessages} />
      <FormRow label="Current password" htmlFor="totp-enroll-password" required>
        <PasswordInput
          id="totp-enroll-password"
          value={password}
          onChange={(event) => {
            onPasswordChange(event.target.value);
          }}
          disabled={busy}
          autoComplete="current-password"
        />
      </FormRow>
      <div className="flex justify-end gap-2">
        <SecondaryButton type="button" onClick={onClose} disabled={busy}>
          Back
        </SecondaryButton>
        <PrimaryButton type="submit" disabled={busy} aria-busy={busy}>
          {busy ? "Continuing…" : "Continue"}
        </PrimaryButton>
      </div>
    </form>
  );
}

type TotpProofStepProps = {
  user: AuthUser;
  mfaProof: MfaProofPayload | null;
  busy: boolean;
  passkeyBusy: boolean;
  errorMessages: string[];
  onClose: () => void;
  onProofReady: (proof: MfaProofPayload) => void;
  onProofChange: (proof: MfaProofPayload | null) => void;
  onPasskeyBusyChange: (busy: boolean) => void;
  onFieldChange: () => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
};

function TotpProofStep({
  user,
  busy,
  passkeyBusy,
  errorMessages,
  onClose,
  onProofReady,
  onProofChange,
  onPasskeyBusyChange,
  onFieldChange,
  onSubmit,
}: TotpProofStepProps) {
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        void onSubmit(event);
      }}
      noValidate
    >
      <FormErrorSummary messages={errorMessages} />
      <MfaProofCollector
        user={user}
        mode="fields"
        passkeyMode="deferred"
        disabled={busy}
        onProofReady={onProofReady}
        onProofChange={onProofChange}
        onBusyChange={onPasskeyBusyChange}
        onFieldChange={onFieldChange}
      />
      <div className="flex justify-end gap-2">
        <SecondaryButton type="button" onClick={onClose} disabled={busy || passkeyBusy}>
          Back
        </SecondaryButton>
        <PrimaryButton type="submit" disabled={busy || passkeyBusy} aria-busy={busy}>
          {busy ? "Continuing…" : "Continue"}
        </PrimaryButton>
      </div>
    </form>
  );
}

export function MfaEnrollModal({
  isOpen,
  method,
  getBearerToken,
  onClose,
  onComplete,
  mode = "enroll",
  user,
}: MfaEnrollModalProps) {
  const mfaEnabled = user.multifactor_enabled === true;
  const [password, setPassword] = useState("");
  const [mfaProof, setMfaProof] = useState<MfaProofPayload | null>(null);
  const [totpBeginUri, setTotpBeginUri] = useState<string | null>(null);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [enrollBusy, setEnrollBusy] = useState(false);

  const totpReady = method === "totp" && totpBeginUri !== null;
  const title = mfaEnrollTitle(method, mode);
  const helpText = mfaEnrollHelpText(method, mode, totpReady, mfaEnabled);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setPassword("");
    setMfaProof(null);
    setTotpBeginUri(null);
    setErrorMessages([]);
    setBusy(false);
    setPasskeyBusy(false);
    setEnrollBusy(false);
  }, [isOpen]);

  const runTotpBegin = useCallback(
    async (stepUp: { password?: string } & MfaProofPayload) => {
      setErrorMessages([]);
      setBusy(true);
      try {
        const bearerToken = await getBearerToken();
        const begin = await totpBegin(bearerToken, stepUp);
        setTotpBeginUri(begin.uri);
      } catch (error) {
        setErrorMessages([mapStepUpAuthError(error, Boolean(stepUp.password))]);
      } finally {
        setBusy(false);
      }
    },
    [getBearerToken]
  );

  async function handlePasswordContinue(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password) {
      setErrorMessages(["Current password is required."]);
      return;
    }
    await runTotpBegin({ password });
  }

  async function handleProofContinue(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mfaProof) {
      const hasWebAuthn = user.multifactor_methods.includes("webauthn");
      setErrorMessages([mfaProofRequiredMessage(hasWebAuthn)]);
      return;
    }
    await runTotpBegin(mfaProof);
  }

  const shellBusy = busy || passkeyBusy || enrollBusy;

  return (
    <StackedModalShell
      isOpen={isOpen}
      title={title}
      description={helpText}
      busy={shellBusy}
      onClose={onClose}
      panelClassName="relative max-h-[min(90vh,720px)] w-full max-w-md overflow-y-auto rounded-sm bg-white p-5 shadow-xl"
    >
      <div className="space-y-4">
        {method === "totp" && mode === "replace" && totpReady ? (
          <CalloutSummary variant="warning">
            Replacing your authenticator invalidates codes from the previous secret. Scan the new QR
            code below and add it as a separate entry in your authenticator.
          </CalloutSummary>
        ) : null}

        {method === "totp" && !totpReady && !mfaEnabled ? (
          <TotpPasswordStep
            password={password}
            busy={busy}
            errorMessages={errorMessages}
            onPasswordChange={(value) => {
              setPassword(value);
              setErrorMessages([]);
            }}
            onClose={onClose}
            onSubmit={handlePasswordContinue}
          />
        ) : null}

        {method === "totp" && !totpReady && mfaEnabled ? (
          <TotpProofStep
            user={user}
            mfaProof={mfaProof}
            busy={busy}
            passkeyBusy={passkeyBusy}
            errorMessages={errorMessages}
            onClose={onClose}
            onProofReady={(proof) => {
              void runTotpBegin(proof);
            }}
            onProofChange={setMfaProof}
            onPasskeyBusyChange={setPasskeyBusy}
            onFieldChange={() => setErrorMessages([])}
            onSubmit={handleProofContinue}
          />
        ) : null}

        {method === "totp" && totpReady && totpBeginUri ? (
          <TotpEnrollPanel
            key="totp-enroll"
            getBearerToken={getBearerToken}
            beginUri={totpBeginUri}
            onComplete={onComplete}
            onCancel={onClose}
            onBusyChange={setEnrollBusy}
          />
        ) : null}

        {method === "webauthn" ? (
          <WebAuthnEnrollPanel
            key="webauthn-enroll"
            getBearerToken={getBearerToken}
            needsPassword={!mfaEnabled}
            needsMfaProof={mfaEnabled}
            user={user}
            onCancel={onClose}
            onComplete={onComplete}
            onBusyChange={setEnrollBusy}
          />
        ) : null}
      </div>
    </StackedModalShell>
  );
}
