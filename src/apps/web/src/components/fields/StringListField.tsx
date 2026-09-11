import { SecondaryButton } from "@web/components/button";
import { EncryptionFieldShell } from "@web/context/Settings/components/encryption/EncryptionFieldShell";
import type { EncryptionFieldKind } from "@web/utils/crypto/types";
import { type KeyboardEvent, type ReactNode, useState } from "react";
import { LuX } from "react-icons/lu";

type StringListFieldProps = {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  inputType?: "text" | "password";
  disabled?: boolean;
  inputClassName?: string;
  maskListedValues?: boolean;
  inputFooter?: ReactNode;
  encryptionKind?: EncryptionFieldKind;
  encryptionHasError?: boolean;
};

function listedValueLabel(value: string, maskListedValues: boolean): string {
  if (!maskListedValues) {
    return value;
  }
  return "•".repeat(Math.min(Math.max(value.length, 8), 12));
}

export function StringListField({
  values,
  onChange,
  placeholder,
  inputType = "text",
  disabled = false,
  inputClassName,
  maskListedValues = false,
  inputFooter,
  encryptionKind,
  encryptionHasError = false,
}: StringListFieldProps) {
  const [draft, setDraft] = useState("");

  function addValue() {
    const next = draft.trim();
    if (!next || disabled) {
      return;
    }
    if (values.includes(next)) {
      setDraft("");
      return;
    }
    onChange([...values, next]);
    setDraft("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      addValue();
    }
  }

  function removeValue(index: number) {
    if (disabled) {
      return;
    }
    onChange(values.filter((_, itemIndex) => itemIndex !== index));
  }

  const input = (
    <input
      type={inputType}
      value={draft}
      disabled={disabled}
      placeholder={placeholder}
      className={encryptionKind ? "form-input-inner" : inputClassName}
      onKeyDown={handleKeyDown}
      onChange={(event) => {
        setDraft(event.target.value);
      }}
    />
  );

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <div className="flex gap-2">
          {encryptionKind ? (
            <div className="min-w-0 flex-1">
              <EncryptionFieldShell kind={encryptionKind} hasError={encryptionHasError}>
                {input}
              </EncryptionFieldShell>
            </div>
          ) : (
            input
          )}
          <SecondaryButton type="button" disabled={disabled || !draft.trim()} onClick={addValue}>
            Add
          </SecondaryButton>
        </div>
        {inputFooter ? <div className="flex justify-end">{inputFooter}</div> : null}
      </div>

      {values.length > 0 ? (
        <ul className="space-y-1.5">
          {values.map((value) => (
            <li
              key={value}
              className="flex items-center justify-between gap-2 rounded-sm border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-700"
            >
              <span className="min-w-0 truncate">{listedValueLabel(value, maskListedValues)}</span>
              <button
                type="button"
                disabled={disabled}
                aria-label="Remove value"
                title="Remove"
                className="flex size-6 shrink-0 items-center justify-center rounded-sm text-slate-400 transition hover:bg-white hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => {
                  removeValue(values.indexOf(value));
                }}
              >
                <LuX className="size-3.5" strokeWidth={2} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
