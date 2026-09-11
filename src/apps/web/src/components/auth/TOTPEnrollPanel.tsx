import {
  isTotpCode,
  TOTP_CODE_INVALID_MESSAGE,
  totpEnrollErrorMessage,
} from "@web/components/auth/helper";
import { MfaVerifyActions } from "@web/components/auth/MfaVerifyActions";
import { FormErrorSummary } from "@web/components/fields/FormErrorSummary";
import { FormRow } from "@web/components/fields/FormRow";
import { PasswordInput } from "@web/components/fields/PasswordInput";
import { parseOtpauthSecret, totpBegin, totpConfirm } from "@web/utils/api/endpoints/auth";
import type { MfaProofPayload } from "@web/utils/api/endpoints/auth/mfa";
import type { TokenPair } from "@web/utils/api/endpoints/auth/types";
import { ApiError } from "@web/utils/api/types";
import QRCode from "qrcode";
import { type MutableRefObject, type SubmitEvent, useEffect, useRef, useState } from "react";

type TotpEnrollPanelProps = {
  getBearerToken: () => Promise<string>;
  onComplete: (tokens: TokenPair | null) => void;
  onCancel?: () => void;
  /** When set, begin was already completed (e.g. after step-up in the settings modal). */
  beginUri?: string;
  /** Step-up for auto-begin when beginUri is unset (login MFA token path usually omits this). */
  stepUp?: MfaProofPayload & { password?: string };
  onBusyChange?: (busy: boolean) => void;
};

async function qrFromUri(uri: string): Promise<{
  qrDataUrl: string;
  secret: string | null;
}> {
  const parsedSecret = parseOtpauthSecret(uri);
  const qrDataUrl = await QRCode.toDataURL(uri, {
    margin: 1,
    width: 200,
  });
  return { qrDataUrl, secret: parsedSecret };
}

function isStaleRequest(requestId: number, loadRequestIdRef: MutableRefObject<number>): boolean {
  return requestId !== loadRequestIdRef.current;
}

async function applyQrFromUri(uri: string): Promise<{ qrDataUrl: string; secret: string | null }> {
  return qrFromUri(uri);
}

async function fetchTotpBeginUri(
  getBearerToken: () => Promise<string>,
  stepUp: (MfaProofPayload & { password?: string }) | undefined,
  signal: AbortSignal
): Promise<string> {
  const bearerToken = await getBearerToken();
  const begin = await totpBegin(bearerToken, stepUp, signal);
  return begin.uri;
}

type LoadTotpEnrollmentParams = {
  beginUri?: string;
  getBearerToken: () => Promise<string>;
  stepUp?: MfaProofPayload & { password?: string };
  signal: AbortSignal;
  requestId: number;
  loadRequestIdRef: MutableRefObject<number>;
  setLoading: (loading: boolean) => void;
  setErrorMessages: (messages: string[]) => void;
  setQrDataUrl: (url: string) => void;
  setSecret: (secret: string | null) => void;
};

async function loadTotpEnrollment({
  beginUri,
  getBearerToken,
  stepUp,
  signal,
  requestId,
  loadRequestIdRef,
  setLoading,
  setErrorMessages,
  setQrDataUrl,
  setSecret,
}: LoadTotpEnrollmentParams): Promise<void> {
  setLoading(true);
  setErrorMessages([]);
  try {
    const uri = beginUri ?? (await fetchTotpBeginUri(getBearerToken, stepUp, signal));
    if (isStaleRequest(requestId, loadRequestIdRef)) {
      return;
    }

    const { qrDataUrl: dataUrl, secret: parsedSecret } = await applyQrFromUri(uri);
    if (isStaleRequest(requestId, loadRequestIdRef)) {
      return;
    }
    setQrDataUrl(dataUrl);
    setSecret(parsedSecret);
  } catch (error) {
    if (isStaleRequest(requestId, loadRequestIdRef)) {
      return;
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      return;
    }
    setErrorMessages([
      totpEnrollErrorMessage(error, "Could not start authenticator setup. Please try again."),
    ]);
  } finally {
    if (!isStaleRequest(requestId, loadRequestIdRef)) {
      setLoading(false);
    }
  }
}

export function TotpEnrollPanel({
  getBearerToken,
  onComplete,
  onCancel,
  beginUri,
  stepUp,
  onBusyChange,
}: TotpEnrollPanelProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const loadRequestIdRef = useRef(0);

  useEffect(() => {
    onBusyChange?.(loading || submitting);
  }, [loading, onBusyChange, submitting]);

  useEffect(() => {
    const requestId = ++loadRequestIdRef.current;
    const abortController = new AbortController();

    void loadTotpEnrollment({
      beginUri,
      getBearerToken,
      stepUp,
      signal: abortController.signal,
      requestId,
      loadRequestIdRef,
      setLoading,
      setErrorMessages,
      setQrDataUrl,
      setSecret,
    });
    return () => {
      abortController.abort();
    };
  }, [beginUri, getBearerToken, stepUp]);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessages([]);

    const trimmedCode = code.trim();
    if (!isTotpCode(trimmedCode)) {
      setErrorMessages([TOTP_CODE_INVALID_MESSAGE]);
      return;
    }

    setSubmitting(true);
    try {
      const bearerToken = await getBearerToken();
      const tokens = await totpConfirm(bearerToken, trimmedCode);
      onComplete(tokens);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setErrorMessages([totpEnrollErrorMessage(error)]);
        return;
      }
      setErrorMessages([
        totpEnrollErrorMessage(error, "Could not confirm authenticator. Please try again."),
      ]);
    } finally {
      setSubmitting(false);
    }
  }

  function handleCodeChange(value: string) {
    setCode(value);
    if (errorMessages.length > 0) {
      setErrorMessages([]);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-live="polite">
        <div className="flex justify-center">
          <div className="h-48 w-48 animate-pulse rounded-sm bg-slate-100" />
        </div>
        <div className="h-10 animate-pulse rounded-sm bg-slate-100" />
      </div>
    );
  }

  if (!qrDataUrl) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <FormErrorSummary title="" messages={errorMessages} />
        {onCancel ? <MfaVerifyActions onBack={onCancel} /> : null}
      </div>
    );
  }

  return (
    <form className="flex min-h-0 flex-1 flex-col gap-4" onSubmit={handleSubmit} noValidate>
      <FormErrorSummary title="" messages={errorMessages} />

      <div className="flex justify-center">
        <img
          src={qrDataUrl}
          alt="QR code for authenticator setup"
          className="h-48 w-48 rounded-sm border border-slate-200 bg-white p-2"
        />
      </div>

      {secret ? (
        <FormRow label="Secret Key" htmlFor="totp-secret">
          <PasswordInput
            encryptionKind="server_encrypted"
            id="totp-secret"
            readOnly
            value={secret}
            revealLabel="secret key"
            className="font-mono"
            autoComplete="off"
            spellCheck={false}
          />
        </FormRow>
      ) : null}

      <FormRow label="Verification Code" htmlFor="totp-code" required>
        <input
          id="totp-code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          value={code}
          onChange={(event) => handleCodeChange(event.target.value)}
          disabled={submitting}
          placeholder="6-digit code"
          className="form-input"
        />
      </FormRow>

      <MfaVerifyActions
        onBack={onCancel}
        backDisabled={submitting}
        primary={{
          label: "Confirm",
          submittingLabel: "Confirming…",
          submitting,
        }}
      />
    </form>
  );
}
