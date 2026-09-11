import { AUTHENTICATOR_METHOD_LABEL, type MfaEnrollMethod } from "@web/components/auth/helper";

const ENROLL_METHOD_DETAILS: Record<MfaEnrollMethod, { title: string; description: string }> = {
  webauthn: {
    title: "Passkey",
    description: "Use your device's biometrics, Face ID, fingerprint, PIN, or security key.",
  },
  totp: {
    title: AUTHENTICATOR_METHOD_LABEL,
    description: "Use an app like Google Authenticator, 1Password, or Bitwarden.",
  },
};

type MfaEnrollMethodPickerProps = {
  options: MfaEnrollMethod[];
  onSelect: (method: MfaEnrollMethod) => void;
};

export function MfaEnrollMethodPicker({ options, onSelect }: MfaEnrollMethodPickerProps) {
  return (
    <ul className="space-y-3">
      {options.map((method) => {
        const { title, description } = ENROLL_METHOD_DETAILS[method];
        return (
          <li key={method}>
            <button
              type="button"
              onClick={() => onSelect(method)}
              className="flex w-full items-start justify-between gap-3 rounded-sm border border-slate-200 px-4 py-3 text-left transition hover:border-[#1a5fb4] hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a5fb4]/40"
            >
              <span className="min-w-0 space-y-1">
                <span className="block text-sm font-semibold text-slate-900">{title}</span>
                <span className="block text-sm text-slate-600">{description}</span>
              </span>
              <span className="shrink-0 pt-0.5 text-slate-400" aria-hidden>
                ›
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
