import { Shell } from "@web/contexts/Settings/components/encryption/Shell";
import type { EncryptionFieldKind } from "@web/utils/crypto/types";
import { type InputHTMLAttributes, useState } from "react";
import { LuEye, LuEyeOff } from "react-icons/lu";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  revealLabel?: string;
  encryptionKind?: EncryptionFieldKind;
  encryptionHasError?: boolean;
};

export function PasswordInput({
  revealLabel = "password",
  className = "",
  disabled = false,
  encryptionKind,
  encryptionHasError = false,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  const revealButtonClassName =
    "inline-flex shrink-0 items-center justify-center border-0 bg-transparent px-3 text-slate-400 transition hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50";

  const field = (
    <>
      <input
        {...props}
        type={visible ? "text" : "password"}
        disabled={disabled}
        className={`form-input-inner ${className}`.trim()}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        aria-label={visible ? `Hide ${revealLabel}` : `Show ${revealLabel}`}
        aria-pressed={visible}
        onClick={() => {
          setVisible((current) => !current);
        }}
        className={revealButtonClassName}
      >
        {visible ? (
          <LuEyeOff className="size-4" strokeWidth={1.75} aria-hidden />
        ) : (
          <LuEye className="size-4" strokeWidth={1.75} aria-hidden />
        )}
      </button>
    </>
  );

  if (encryptionKind) {
    return (
      <Shell kind={encryptionKind} hasError={encryptionHasError}>
        {field}
      </Shell>
    );
  }

  return <div className="form-input-shell">{field}</div>;
}
