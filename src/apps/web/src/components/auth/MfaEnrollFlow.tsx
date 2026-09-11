import {
  filterSupportedMfaMethods,
  type MfaEnrollFlowPhase,
  type MfaEnrollMethod,
  mfaEnrollSubtitle,
  sortMfaEnrollMethods,
} from "@web/components/auth/helper";
import { MfaEnrollMethodPicker } from "@web/components/auth/MfaEnrollMethodPicker";
import { TotpEnrollPanel } from "@web/components/auth/TOTPEnrollPanel";
import { WebAuthnEnrollPanel } from "@web/components/auth/WebAuthnEnrollPanel";
import { SecondaryButton } from "@web/components/button";
import type { TokenPair } from "@web/utils/api/endpoints/auth/types";
import { useEffect, useMemo, useState } from "react";

type MfaEnrollFlowProps = {
  methods: string[];
  getBearerToken: () => Promise<string>;
  onComplete: (tokens: TokenPair | null) => void;
  onCancel?: () => void;
};

const ENROLL_METHODS: readonly MfaEnrollMethod[] = ["totp", "webauthn"];

function availableMethods(methods: string[]): MfaEnrollMethod[] {
  return sortMfaEnrollMethods(filterSupportedMfaMethods(methods, ENROLL_METHODS, ENROLL_METHODS));
}

function initialPhase(options: MfaEnrollMethod[]): MfaEnrollFlowPhase {
  if (options.length === 1) {
    return { kind: "method", method: options[0] };
  }
  return { kind: "pick" };
}

export function MfaEnrollFlow({
  methods,
  getBearerToken,
  onComplete,
  onCancel,
}: MfaEnrollFlowProps) {
  const options = useMemo(() => availableMethods(methods), [methods]);
  const [phase, setPhase] = useState<MfaEnrollFlowPhase>(() => initialPhase(options));

  useEffect(() => {
    setPhase(initialPhase(options));
  }, [options]);

  const subtitle = useMemo(() => mfaEnrollSubtitle(phase), [phase]);

  function handleSelect(method: MfaEnrollMethod) {
    setPhase({ kind: "method", method });
  }

  function handleBack() {
    if (options.length > 1) {
      setPhase({ kind: "pick" });
      return;
    }
    onCancel?.();
  }

  if (phase.kind === "pick") {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Set up multi-factor authentication
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Your account must enroll in MFA before you can sign in.
          </p>
          {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
        </div>
        <MfaEnrollMethodPicker options={options} onSelect={handleSelect} />
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
        <h2 className="text-base font-semibold text-slate-900">
          Set up multi-factor authentication
        </h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        {phase.method === "totp" ? (
          <TotpEnrollPanel
            key="totp"
            getBearerToken={getBearerToken}
            onComplete={onComplete}
            onCancel={handleBack}
          />
        ) : null}
        {phase.method === "webauthn" ? (
          <WebAuthnEnrollPanel
            key="webauthn"
            getBearerToken={getBearerToken}
            onComplete={onComplete}
            onCancel={handleBack}
          />
        ) : null}
      </div>
    </div>
  );
}
