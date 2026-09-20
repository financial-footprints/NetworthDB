import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";
import { startAuthentication } from "@simplewebauthn/browser";
import {
  PASSKEY_VERIFY_DESCRIPTION,
  PASSKEY_VERIFY_INSTRUCTION,
  passkeyNotAllowedMessage,
  passkeyVerifyErrorMessage,
  useMfaVerifyErrors,
} from "@web/components/Auth/helpers";
import { MfaVerifyActions } from "@web/components/Auth/MfaVerifyActions";
import { FormErrorSummary } from "@web/components/Fields/FormErrorSummary";
import { webauthnLoginBegin, webauthnLoginFinish } from "@web/utils/api/routes/auth";
import type { TokenPair, VaultSlot } from "@web/utils/api/routes/auth/types";
import { ApiError } from "@web/utils/api/types";
import {
  buildPrfAuthenticationExtensions,
  extractWebAuthnUnlockContext,
  type WebAuthnUnlockContext,
} from "@web/utils/crypto/vault";
import { errorMessage } from "@web/utils/errors";
import { type SubmitEvent, useCallback, useEffect, useRef, useState } from "react";

export type WebAuthnVerifyComplete = {
  tokens: TokenPair;
  webauthn?: WebAuthnUnlockContext;
};

type WebAuthnVerifyPanelProps = {
  getBearerToken: () => Promise<string>;
  onComplete: (result: WebAuthnVerifyComplete) => void;
  onBack?: () => void;
  onErrorMessagesChange?: (messages: string[]) => void;
  autoStart?: boolean;
  prfSlots?: VaultSlot[];
};

export function WebAuthnVerifyPanel({
  getBearerToken,
  onComplete,
  onBack,
  onErrorMessagesChange,
  autoStart = false,
  prfSlots = [],
}: WebAuthnVerifyPanelProps) {
  const [submitting, setSubmitting] = useState(autoStart);
  const [hasFailed, setHasFailed] = useState(false);
  const autoStartAttemptedRef = useRef(false);
  const { setErrors, showInlineErrors, localErrorMessages } =
    useMfaVerifyErrors(onErrorMessagesChange);

  const handleAuthenticate = useCallback(async () => {
    setErrors([]);
    setHasFailed(false);
    setSubmitting(true);
    try {
      const bearerToken = await getBearerToken();
      const begin = await webauthnLoginBegin(bearerToken);
      const prfExtensions = buildPrfAuthenticationExtensions(prfSlots);
      const options = {
        ...begin.options,
        extensions: {
          ...(begin.options.extensions ?? {}),
          ...(prfExtensions ?? {}),
        },
      } as PublicKeyCredentialRequestOptionsJSON;
      const assertion = await startAuthentication({ optionsJSON: options });
      const tokens = await webauthnLoginFinish(bearerToken, {
        sessionId: begin.sessionId,
        response: assertion,
      });
      const webauthn = extractWebAuthnUnlockContext(
        assertion.rawId,
        assertion.clientExtensionResults,
        prfSlots
      );
      onComplete({ tokens, webauthn: webauthn ?? undefined });
    } catch (error) {
      setHasFailed(true);
      if (error instanceof ApiError && error.status === 401) {
        setErrors([passkeyVerifyErrorMessage(error)]);
        return;
      }
      if (error instanceof Error && error.name === "NotAllowedError") {
        setErrors([passkeyNotAllowedMessage("sign-in")]);
        return;
      }
      setErrors([errorMessage(error, "Could not verify with passkey. Please try again.")]);
    } finally {
      setSubmitting(false);
    }
  }, [getBearerToken, onComplete, prfSlots, setErrors]);

  useEffect(() => {
    if (!autoStart || autoStartAttemptedRef.current) {
      return;
    }
    autoStartAttemptedRef.current = true;
    void handleAuthenticate();
  }, [autoStart, handleAuthenticate]);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    void handleAuthenticate();
  }

  const showRetry = autoStart && hasFailed;
  const showContinue = !autoStart && !showRetry;

  return (
    <form className="flex min-h-0 flex-1 flex-col gap-4" onSubmit={handleSubmit} noValidate>
      {showInlineErrors && localErrorMessages.length > 0 ? (
        <FormErrorSummary title="" messages={localErrorMessages} />
      ) : null}

      <p className="text-sm text-slate-600">{PASSKEY_VERIFY_INSTRUCTION}</p>

      <p className="text-sm text-slate-600">
        {submitting && !hasFailed ? "Waiting for passkey…" : PASSKEY_VERIFY_DESCRIPTION}
      </p>

      <MfaVerifyActions
        onBack={onBack}
        backDisabled={submitting}
        primary={
          showRetry
            ? {
                label: "Retry",
                submittingLabel: "Verifying passkey…",
                submitting,
              }
            : showContinue
              ? {
                  label: "Continue",
                  submittingLabel: "Verifying passkey…",
                  submitting,
                }
              : undefined
        }
      />
    </form>
  );
}
