import {
  EncryptionKindSymbol,
  encryptionKindGuideItem,
} from "@web/context/Settings/components/encryption/EncryptionKindSymbol";
import type { EncryptionFieldKind } from "@web/utils/crypto/types";
import type { ReactNode } from "react";

type EncryptionFieldShellProps = {
  kind: EncryptionFieldKind;
  leading?: ReactNode;
  hasError?: boolean;
  children: ReactNode;
};

function encryptionShellClassName(hasError = false): string {
  if (!hasError) {
    return "form-input-shell";
  }

  return "form-input-shell form-input-shell-error";
}

export function EncryptionFieldShell({
  kind,
  leading,
  hasError = false,
  children,
}: EncryptionFieldShellProps) {
  const { title } = encryptionKindGuideItem(kind);

  return (
    <div className={encryptionShellClassName(hasError)}>
      {leading}
      {children}
      <span
        className="flex shrink-0 items-center border-l border-slate-200 px-2.5 py-2"
        role="img"
        aria-label={title}
        title={title}
      >
        <EncryptionKindSymbol kind={kind} />
      </span>
    </div>
  );
}
