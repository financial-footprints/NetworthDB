import {
  AUTHENTICATOR_CODE_LABEL,
  type MfaProofMethod,
  normalizeRecoveryCode,
  passkeyNotAllowedMessage,
} from "@web/components/auth/helper";
import { DangerButton, PrimaryButton, SecondaryButton } from "@web/components/button";
import { FormErrorSummary } from "@web/components/fields/FormErrorSummary";
import { FormRow } from "@web/components/fields/FormRow";
import { HoverPopover } from "@web/components/popover";
import { collectWebAuthnMfaProof, withSessionToken } from "@web/utils/api/endpoints/auth";
import type { MfaProofPayload, WebAuthnMfaProof } from "@web/utils/api/endpoints/auth/mfa";
import type { AuthUser } from "@web/utils/api/endpoints/auth/types";
import { errorMessage } from "@web/utils/errors";
import {
  type ReactNode,
  type RefObject,
  type SubmitEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

type MfaProofCollectorProps = {
  user: AuthUser;
  onProofReady: (proof: MfaProofPayload) => void | Promise<void>;
  /** When set, only these methods are offered (still filtered by what the user has). */
  allowedMethods?: readonly MfaProofMethod[];
  includeRecoveryCode?: boolean;
  /** immediate: deliver via onProofReady on passkey success. deferred: also updates onProofChange for parent form state, and still calls onProofReady so parents can auto-advance. */
  passkeyMode?: "immediate" | "deferred";
  /** form: own form + submit. fields: embed in parent form; use onProofChange for live typed proof. */
  mode?: "form" | "fields";
  disabled?: boolean;
  submitLabel?: string;
  submitTone?: "primary" | "danger";
  footer?: ReactNode;
  onCancel?: () => void;
  onProofChange?: (proof: MfaProofPayload | null) => void;
  onBusyChange?: (busy: boolean) => void;
  /** Errors from a parent-side async proof validation (e.g. totp/begin). */
  serverErrorMessages?: string[];
  onFieldChange?: () => void;
};

function resolveProofOptions(
  user: AuthUser,
  allowedMethods: readonly MfaProofMethod[] | undefined,
  includeRecoveryCode: boolean
): MfaProofMethod[] {
  const hasTotp = user.multifactor_methods.includes("totp");
  const hasWebAuthn = user.multifactor_methods.includes("webauthn");
  const hasRecovery = user.recovery_codes_enabled || user.multifactor_methods.includes("recovery");

  const candidates =
    allowedMethods ??
    ([
      ...(hasTotp ? (["totp"] as const) : []),
      ...(includeRecoveryCode && hasRecovery ? (["recovery"] as const) : []),
      ...(hasWebAuthn ? (["webauthn"] as const) : []),
    ] as MfaProofMethod[]);

  return candidates.filter((method) => {
    if (method === "totp") {
      return hasTotp;
    }
    if (method === "recovery") {
      return hasRecovery;
    }
    return hasWebAuthn;
  });
}

function proofFromFields(
  totp: string,
  recoveryCode: string,
  webauthnProof: WebAuthnMfaProof | null
): MfaProofPayload | null {
  const trimmedTotp = totp.trim();
  const trimmedRecovery = normalizeRecoveryCode(recoveryCode);
  const count = (trimmedTotp ? 1 : 0) + (trimmedRecovery ? 1 : 0) + (webauthnProof ? 1 : 0);

  if (count !== 1) {
    return null;
  }
  if (webauthnProof) {
    return {
      webauthn_session_id: webauthnProof.webauthn_session_id,
      webauthn_response: webauthnProof.webauthn_response,
    };
  }
  if (trimmedTotp) {
    return { totp: trimmedTotp };
  }
  return { recovery_code: trimmedRecovery };
}

function mapPasskeyProofError(error: unknown): string {
  if (error instanceof Error && error.name === "NotAllowedError") {
    return passkeyNotAllowedMessage("verification");
  }
  return errorMessage(error, "Could not verify with passkey. Please try again.");
}

async function deliverProofToParent(
  proof: MfaProofPayload,
  onProofReady: (proof: MfaProofPayload) => void | Promise<void>,
  proofDeliveredRef: RefObject<boolean>
): Promise<void> {
  proofDeliveredRef.current = true;
  try {
    await Promise.resolve(onProofReady(proof));
  } finally {
    proofDeliveredRef.current = false;
  }
}

function MfaProofDivider() {
  return (
    <div className="flex items-center gap-3" aria-hidden>
      <div className="h-px flex-1 bg-slate-200" />
      <span className="text-xs font-medium tracking-wide text-slate-400 uppercase">or</span>
      <div className="h-px flex-1 bg-slate-200" />
    </div>
  );
}

type PasskeyOnlyViewProps = {
  displayedErrorMessages: string[];
  passkeySubmitting: boolean;
  footer?: ReactNode;
  onCancel?: () => void;
  onRetry: () => void;
};

function PasskeyOnlyView({
  displayedErrorMessages,
  passkeySubmitting,
  footer,
  onCancel,
  onRetry,
}: PasskeyOnlyViewProps) {
  return (
    <div className="space-y-4">
      <FormErrorSummary messages={displayedErrorMessages} />

      {passkeySubmitting ? (
        <p className="text-sm text-slate-600" aria-busy="true">
          Verifying passkey…
        </p>
      ) : null}

      {!passkeySubmitting && displayedErrorMessages.length > 0 ? (
        <SecondaryButton type="button" onClick={onRetry}>
          Try again
        </SecondaryButton>
      ) : null}

      {footer}

      {onCancel ? (
        <div className="flex justify-end">
          <SecondaryButton type="button" onClick={onCancel} disabled={passkeySubmitting}>
            Cancel
          </SecondaryButton>
        </div>
      ) : null}
    </div>
  );
}

type MfaProofOptionFieldProps = {
  option: MfaProofMethod;
  showDivider: boolean;
  idPrefix: string;
  totp: string;
  recoveryCode: string;
  webauthnProof: WebAuthnMfaProof | null;
  busy: boolean;
  passkeySubmitting: boolean;
  passkeyMode: "immediate" | "deferred";
  onTotpChange: (value: string) => void;
  onRecoveryChange: (value: string) => void;
  onPasskeyClick: () => void;
};

function MfaProofOptionField({
  option,
  showDivider,
  idPrefix,
  totp,
  recoveryCode,
  webauthnProof,
  busy,
  passkeySubmitting,
  passkeyMode,
  onTotpChange,
  onRecoveryChange,
  onPasskeyClick,
}: MfaProofOptionFieldProps) {
  return (
    <div className="space-y-3">
      {showDivider ? <MfaProofDivider /> : null}

      {option === "totp" ? (
        <FormRow label={AUTHENTICATOR_CODE_LABEL} htmlFor={`${idPrefix}-totp`}>
          <input
            id={`${idPrefix}-totp`}
            type="text"
            inputMode="numeric"
            value={totp}
            onChange={(event) => onTotpChange(event.target.value)}
            disabled={busy || webauthnProof !== null}
            className="form-input"
            autoComplete="one-time-code"
            placeholder="6-digit code"
          />
        </FormRow>
      ) : null}

      {option === "recovery" ? (
        <FormRow label="Recovery code" htmlFor={`${idPrefix}-recovery`}>
          <input
            id={`${idPrefix}-recovery`}
            type="text"
            value={recoveryCode}
            onChange={(event) => onRecoveryChange(event.target.value)}
            disabled={busy || webauthnProof !== null}
            className="form-input"
            autoComplete="off"
            placeholder="Enter unused recovery code"
          />
        </FormRow>
      ) : null}

      {option === "webauthn" ? (
        <div className="space-y-2">
          <FormRow label="Passkey">
            <SecondaryButton
              type="button"
              disabled={busy || Boolean(totp.trim() || recoveryCode.trim())}
              aria-busy={passkeySubmitting}
              onClick={onPasskeyClick}
            >
              {passkeySubmitting
                ? "Verifying passkey…"
                : passkeyMode === "deferred" && webauthnProof
                  ? "Passkey verified"
                  : "Verify with passkey"}
            </SecondaryButton>
          </FormRow>
        </div>
      ) : null}
    </div>
  );
}

export function MfaProofCollector({
  user,
  onProofReady,
  allowedMethods,
  includeRecoveryCode = user.recovery_codes_enabled ||
    user.multifactor_methods.includes("recovery"),
  passkeyMode = "immediate",
  mode = "form",
  disabled = false,
  submitLabel = "Continue",
  submitTone = "primary",
  footer,
  onCancel,
  onProofChange,
  onBusyChange,
  serverErrorMessages = [],
  onFieldChange,
}: MfaProofCollectorProps) {
  const idPrefix = useId().replace(/:/g, "");
  const [totp, setTotp] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [webauthnProof, setWebauthnProof] = useState<WebAuthnMfaProof | null>(null);
  const [passkeySubmitting, setPasskeySubmitting] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const proofDeliveredRef = useRef(false);
  const passkeyAutoStartedRef = useRef(false);

  const mfaProofOptions = resolveProofOptions(user, allowedMethods, includeRecoveryCode);
  const hasWebAuthn = mfaProofOptions.includes("webauthn");
  const isPasskeyOnly = mfaProofOptions.length === 1 && mfaProofOptions[0] === "webauthn";
  const showFieldset = mfaProofOptions.length > 1;
  const busy = disabled || passkeySubmitting || formSubmitting;
  const displayedErrorMessages = [...errorMessages, ...serverErrorMessages];

  const mfaProofHint =
    mfaProofOptions.length > 1
      ? "Provide one of the following to verify your identity."
      : "Verify your identity to continue.";

  useEffect(() => {
    onBusyChange?.(passkeySubmitting);
  }, [onBusyChange, passkeySubmitting]);

  useEffect(() => {
    if (mode !== "fields" && passkeyMode !== "deferred") {
      return;
    }
    onProofChange?.(proofFromFields(totp, recoveryCode, webauthnProof));
  }, [mode, onProofChange, passkeyMode, recoveryCode, totp, webauthnProof]);

  const deliverPasskeyProof = useCallback(async () => {
    if (disabled || proofDeliveredRef.current) {
      return;
    }

    setErrorMessages([]);
    setPasskeySubmitting(true);
    try {
      const proof = await withSessionToken((sessionToken) => collectWebAuthnMfaProof(sessionToken));
      if (passkeyMode === "deferred") {
        setWebauthnProof(proof);
        setTotp("");
        setRecoveryCode("");
      }
      await deliverProofToParent(
        {
          webauthn_session_id: proof.webauthn_session_id,
          webauthn_response: proof.webauthn_response,
        },
        onProofReady,
        proofDeliveredRef
      );
      if (passkeyMode === "deferred") {
        setWebauthnProof(null);
      }
    } catch (error) {
      proofDeliveredRef.current = false;
      setErrorMessages([mapPasskeyProofError(error)]);
    } finally {
      setPasskeySubmitting(false);
    }
  }, [disabled, onProofReady, passkeyMode]);

  useEffect(() => {
    if (
      !isPasskeyOnly ||
      passkeyMode !== "immediate" ||
      mode !== "form" ||
      disabled ||
      passkeyAutoStartedRef.current
    ) {
      return;
    }
    passkeyAutoStartedRef.current = true;
    void deliverPasskeyProof();
  }, [deliverPasskeyProof, disabled, isPasskeyOnly, mode, passkeyMode]);

  function handleTotpChange(value: string) {
    setTotp(value);
    setRecoveryCode("");
    setWebauthnProof(null);
    onFieldChange?.();
  }

  function handleRecoveryChange(value: string) {
    setRecoveryCode(value);
    setTotp("");
    setWebauthnProof(null);
    onFieldChange?.();
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessages([]);

    const proof = proofFromFields(totp, recoveryCode, webauthnProof);
    if (!proof) {
      if (totp.trim() && recoveryCode.trim()) {
        setErrorMessages(["Provide only one verification method."]);
        return;
      }
      setErrorMessages([
        hasWebAuthn
          ? "Enter an authenticator code, recovery code, or verify with a passkey."
          : "Enter an authenticator code or recovery code.",
      ]);
      return;
    }

    setFormSubmitting(true);
    void Promise.resolve(onProofReady(proof)).finally(() => {
      setFormSubmitting(false);
    });
  }

  if (mfaProofOptions.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        No verification methods are available. Sign in again and try later.
      </p>
    );
  }

  if (isPasskeyOnly && passkeyMode === "immediate" && mode === "form") {
    return (
      <PasskeyOnlyView
        displayedErrorMessages={displayedErrorMessages}
        passkeySubmitting={passkeySubmitting}
        footer={footer}
        onCancel={onCancel}
        onRetry={() => {
          proofDeliveredRef.current = false;
          void deliverPasskeyProof();
        }}
      />
    );
  }

  const proofFields = mfaProofOptions.map((option, index) => (
    <MfaProofOptionField
      key={option}
      option={option}
      showDivider={index > 0}
      idPrefix={idPrefix}
      totp={totp}
      recoveryCode={recoveryCode}
      webauthnProof={webauthnProof}
      busy={busy}
      passkeySubmitting={passkeySubmitting}
      passkeyMode={passkeyMode}
      onTotpChange={handleTotpChange}
      onRecoveryChange={handleRecoveryChange}
      onPasskeyClick={() => {
        void deliverPasskeyProof();
      }}
    />
  ));

  const fieldsBody = (
    <>
      <FormErrorSummary messages={displayedErrorMessages} />

      {showFieldset ? (
        <fieldset className="space-y-3 rounded-sm border border-slate-200 bg-slate-50/40 p-4">
          <legend className="flex items-center gap-2 bg-white px-1 text-sm font-medium text-slate-900">
            Second factor
            <HoverPopover ariaLabel="About second factor">{mfaProofHint}</HoverPopover>
          </legend>
          {proofFields}
        </fieldset>
      ) : (
        <div className="space-y-3">{proofFields}</div>
      )}

      {footer}
    </>
  );

  if (mode === "fields") {
    return <div className="space-y-4">{fieldsBody}</div>;
  }

  const submitButton =
    submitTone === "danger" ? (
      <DangerButton type="submit" variant="solid" disabled={busy}>
        {submitLabel}
      </DangerButton>
    ) : (
      <PrimaryButton type="submit" disabled={busy}>
        {submitLabel}
      </PrimaryButton>
    );

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      {fieldsBody}

      {onCancel ? (
        <div className="flex justify-end gap-2">
          <SecondaryButton type="button" onClick={onCancel} disabled={busy}>
            Cancel
          </SecondaryButton>
          {submitButton}
        </div>
      ) : (
        submitButton
      )}
    </form>
  );
}
