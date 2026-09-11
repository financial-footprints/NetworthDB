import { startRegistration } from "@simplewebauthn/browser";
import {
  mapStepUpAuthError,
  mfaProofRequiredMessage,
  passkeyNotAllowedMessage,
} from "@web/components/auth/helper";
import { MfaProofCollector } from "@web/components/auth/MfaProofCollector";
import { MfaVerifyActions } from "@web/components/auth/MfaVerifyActions";
import { FormErrorSummary } from "@web/components/fields/FormErrorSummary";
import { FormRow } from "@web/components/fields/FormRow";
import { PasswordInput } from "@web/components/fields/PasswordInput";
import { webauthnRegisterBegin, webauthnRegisterFinish } from "@web/utils/api/endpoints/auth";
import type { MfaProofPayload } from "@web/utils/api/endpoints/auth/mfa";
import type { AuthUser, TokenPair } from "@web/utils/api/endpoints/auth/types";
import { ApiError } from "@web/utils/api/types";
import { errorMessage } from "@web/utils/errors";
import { type SubmitEvent, useEffect, useRef, useState } from "react";

type WebAuthnEnrollPanelProps = {
  getBearerToken: () => Promise<string>;
  onComplete: (tokens: TokenPair | null) => void;
  onCancel?: () => void;
  /** First enroll from settings (no MFA yet): require password. */
  needsPassword?: boolean;
  /** MFA already enabled: require MFA proof instead of password. */
  needsMfaProof?: boolean;
  user?: AuthUser;
  onBusyChange?: (busy: boolean) => void;
};

type WebAuthnStepUp = MfaProofPayload | { password: string };

function buildWebAuthnStepUp(
  needsPassword: boolean,
  needsMfaProof: boolean,
  password: string,
  proof: MfaProofPayload | null
): WebAuthnStepUp | undefined {
  if (needsPassword) {
    return { password };
  }
  if (needsMfaProof && proof) {
    return proof;
  }
  return undefined;
}

function mapWebAuthnRegisterError(
  error: unknown,
  needsPassword: boolean,
  needsMfaProof: boolean
): string {
  if (error instanceof ApiError && error.status === 401) {
    return needsPassword
      ? "Password verification failed. Please try again."
      : needsMfaProof
        ? "MFA verification failed. Please try again."
        : "Passkey registration failed. Please try again.";
  }
  if (error instanceof ApiError && error.status === 400 && needsPassword) {
    return mapStepUpAuthError(error, true);
  }
  if (error instanceof Error && error.name === "NotAllowedError") {
    return passkeyNotAllowedMessage("registration");
  }
  return errorMessage(error, "Could not register passkey. Please try again.");
}

async function runWebAuthnRegistration(
  bearerToken: string,
  stepUp: WebAuthnStepUp | undefined,
  name: string
): Promise<TokenPair | null> {
  const begin = await webauthnRegisterBegin(bearerToken, stepUp);
  const attestation = await startRegistration({
    optionsJSON: begin.options.publicKey,
  });
  return webauthnRegisterFinish(bearerToken, {
    session_id: begin.session_id,
    response: attestation,
    name: name.trim() || undefined,
    ...(stepUp ?? {}),
  });
}

export function WebAuthnEnrollPanel({
  getBearerToken,
  onComplete,
  onCancel,
  needsPassword = false,
  needsMfaProof = false,
  user,
  onBusyChange,
}: WebAuthnEnrollPanelProps) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [mfaProof, setMfaProof] = useState<MfaProofPayload | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const nameRef = useRef(name);
  const passwordRef = useRef(password);

  nameRef.current = name;
  passwordRef.current = password;

  const busy = submitting || passkeyBusy;

  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  async function handleRegister(proofOverride?: MfaProofPayload | null) {
    setErrorMessages([]);

    const resolvedProof = proofOverride ?? mfaProof;

    if (needsPassword && !passwordRef.current) {
      setErrorMessages(["Current password is required."]);
      return;
    }

    if (needsMfaProof && !resolvedProof) {
      const hasWebAuthn = user?.multifactor_methods.includes("webauthn") ?? false;
      setErrorMessages([mfaProofRequiredMessage(hasWebAuthn)]);
      return;
    }

    setSubmitting(true);
    try {
      const bearerToken = await getBearerToken();
      const stepUp = buildWebAuthnStepUp(
        needsPassword,
        needsMfaProof,
        passwordRef.current,
        resolvedProof
      );
      const tokens = await runWebAuthnRegistration(bearerToken, stepUp, nameRef.current);
      onComplete(tokens);
    } catch (error) {
      setErrorMessages([mapWebAuthnRegisterError(error, needsPassword, needsMfaProof)]);
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    void handleRegister();
  }

  return (
    <form className="flex min-h-0 flex-1 flex-col gap-4" onSubmit={handleSubmit} noValidate>
      <FormErrorSummary title="" messages={errorMessages} />

      <FormRow label="Passkey Name" htmlFor="passkey-name" encryptionKind="server_plain">
        <input
          id="passkey-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={busy}
          placeholder="Passkey"
          className="form-input"
          autoComplete="off"
        />
      </FormRow>

      {needsPassword ? (
        <FormRow label="Current Password" htmlFor="passkey-enroll-password" required>
          <PasswordInput
            id="passkey-enroll-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setErrorMessages([]);
            }}
            disabled={busy}
            autoComplete="current-password"
          />
        </FormRow>
      ) : null}

      {needsMfaProof && user ? (
        <MfaProofCollector
          user={user}
          mode="fields"
          passkeyMode="deferred"
          disabled={busy}
          onProofReady={(proof) => {
            setMfaProof(proof);
            void handleRegister(proof);
          }}
          onProofChange={setMfaProof}
          onBusyChange={setPasskeyBusy}
          onFieldChange={() => setErrorMessages([])}
        />
      ) : null}

      <MfaVerifyActions
        onBack={onCancel}
        backDisabled={busy}
        primary={{
          label: "Register",
          submittingLabel: "Registering…",
          submitting: busy,
        }}
      />
    </form>
  );
}
