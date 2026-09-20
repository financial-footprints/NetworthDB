import { FormFieldLabel } from "@web/components/Fields/FormFieldLabel";
import { Hover } from "@web/components/Popover/Hover";
import { Shell } from "@web/contexts/Settings/components/encryption/Shell";
import type { EncryptionFieldKind } from "@web/utils/crypto/types";
import type { ReactNode } from "react";

/** Indent for action rows aligned under the FormRow control column (140 + 16). */
export const formRowActionsClassName = "flex items-center gap-3 sm:pl-[156px]";

type FormRowProps = {
  label: string;
  htmlFor?: string;
  required?: boolean;
  info?: ReactNode;
  infoAriaLabel?: string;
  /** Only when the field value is persisted to the database; see `encryption.ts`. */
  encryptionKind?: EncryptionFieldKind;
  encryptionHasError?: boolean;
  /** Always use label-left / control-right grid (e.g. narrow popovers below `sm`). */
  compact?: boolean;
  children: ReactNode;
};

export function FormRow({
  label,
  htmlFor,
  required = false,
  info,
  infoAriaLabel,
  encryptionKind,
  encryptionHasError = false,
  compact = false,
  children,
}: FormRowProps) {
  const control = encryptionKind ? (
    <Shell kind={encryptionKind} hasError={encryptionHasError}>
      {children}
    </Shell>
  ) : (
    children
  );

  return (
    <div
      className={
        compact
          ? "grid grid-cols-[140px_1fr] items-center gap-4"
          : "grid grid-cols-1 items-center gap-1 sm:grid-cols-[140px_1fr] sm:gap-4"
      }
    >
      <div className="flex w-full items-center justify-between gap-2">
        <FormFieldLabel htmlFor={htmlFor} required={required}>
          {label}
        </FormFieldLabel>
        {info ? <Hover ariaLabel={infoAriaLabel ?? `About ${label}`}>{info}</Hover> : null}
      </div>
      <div className="min-w-0">{control}</div>
    </div>
  );
}
