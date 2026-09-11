import {
  filterSupportedMfaMethods,
  type MfaVerifyFlowPhase,
  type MfaVerifyMethod,
  mfaVerifySubtitle,
  sortMfaVerifyMethods,
} from "@web/components/auth/helper";
import { MfaVerifyMethodPicker } from "@web/components/auth/MfaVerifyMethodPicker";
import { RecoveryCodeVerifyPanel } from "@web/components/auth/RecoveryCodeVerifyPanel";
import { TotpVerifyPanel } from "@web/components/auth/TOTPVerifyPanel";
import {
  type WebAuthnVerifyComplete,
  WebAuthnVerifyPanel,
} from "@web/components/auth/WebAuthnVerifyPanel";
import { SecondaryButton } from "@web/components/button";
import type { TokenPair, VaultSlot } from "@web/utils/api/endpoints/auth/types";
import type { WebAuthnUnlockContext } from "@web/utils/crypto/vault";
import { useEffect, useMemo, useState } from "react";

export type MfaVerifyComplete = {
  tokens: TokenPair;
  webauthn?: WebAuthnUnlockContext;
};

type MfaVerifyFlowProps = {
  methods: string[];
  getBearerToken: () => Promise<string>;
  onComplete: (result: MfaVerifyComplete) => void;
  onCancel?: () => void;
  onErrorMessagesChange?: (messages: string[]) => void;
  prfSlots?: VaultSlot[];
};

const VERIFY_METHODS: readonly MfaVerifyMethod[] = ["totp", "webauthn", "recovery"];
const VERIFY_FALLBACK: readonly MfaVerifyMethod[] = ["totp", "webauthn"];

function availableMethods(methods: string[]): MfaVerifyMethod[] {
  return sortMfaVerifyMethods(filterSupportedMfaMethods(methods, VERIFY_METHODS, VERIFY_FALLBACK));
}

function initialPhase(options: MfaVerifyMethod[]): MfaVerifyFlowPhase {
  if (options.length === 1) {
    return { kind: "method", method: options[0] };
  }
  return { kind: "pick" };
}

export function MfaVerifyFlow({
  methods,
  getBearerToken,
  onComplete,
  onCancel,
  onErrorMessagesChange,
  prfSlots = [],
}: MfaVerifyFlowProps) {
  const options = useMemo(() => availableMethods(methods), [methods]);
  const [phase, setPhase] = useState<MfaVerifyFlowPhase>(() => initialPhase(options));

  useEffect(() => {
    setPhase(initialPhase(options));
  }, [options]);

  const subtitle = useMemo(() => mfaVerifySubtitle(options, phase), [options, phase]);

  function handleSelect(method: MfaVerifyMethod) {
    onErrorMessagesChange?.([]);
    setPhase({ kind: "method", method });
  }

  function handleBack() {
    onErrorMessagesChange?.([]);
    if (options.length > 1) {
      setPhase({ kind: "pick" });
      return;
    }
    onCancel?.();
  }

  function handleTokenComplete(tokens: TokenPair) {
    onComplete({ tokens });
  }

  function handleWebAuthnComplete(result: WebAuthnVerifyComplete) {
    onComplete(result);
  }

  function renderPanel() {
    if (phase.kind === "pick") {
      return (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <h2 className="text-base font-semibold text-slate-900">Multi-factor authentication</h2>
          <MfaVerifyMethodPicker options={options} onSelect={handleSelect} />
          {onCancel ? (
            <div className="mt-auto flex justify-end pt-1">
              <SecondaryButton type="button" onClick={onCancel}>
                Back
              </SecondaryButton>
            </div>
          ) : null}
        </div>
      );
    }

    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Multi-factor authentication</h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          {phase.method === "totp" ? (
            <TotpVerifyPanel
              key="totp"
              getBearerToken={getBearerToken}
              onComplete={handleTokenComplete}
              onBack={handleBack}
              onErrorMessagesChange={onErrorMessagesChange}
            />
          ) : null}
          {phase.method === "webauthn" ? (
            <WebAuthnVerifyPanel
              key="webauthn"
              autoStart
              getBearerToken={getBearerToken}
              prfSlots={prfSlots}
              onComplete={handleWebAuthnComplete}
              onBack={handleBack}
              onErrorMessagesChange={onErrorMessagesChange}
            />
          ) : null}
          {phase.method === "recovery" ? (
            <RecoveryCodeVerifyPanel
              key="recovery"
              getBearerToken={getBearerToken}
              onComplete={handleTokenComplete}
              onBack={handleBack}
              onErrorMessagesChange={onErrorMessagesChange}
            />
          ) : null}
        </div>
      </div>
    );
  }

  return <div className="flex min-h-0 flex-1 flex-col">{renderPanel()}</div>;
}
