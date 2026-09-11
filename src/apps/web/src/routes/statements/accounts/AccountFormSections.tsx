import { DatePickerField } from "@web/components/fields/DatePickerField";
import { FormFieldError } from "@web/components/fields/FormFieldError";
import { FormFieldLabel } from "@web/components/fields/FormFieldLabel";
import { StringListField } from "@web/components/fields/StringListField";
import { EncryptionFieldShell } from "@web/context/Settings/components/encryption/EncryptionFieldShell";
import {
  MailMatchingHelp,
  StatementMatchingHelp,
  StatementPasswordsHelp,
} from "@web/routes/statements/accounts/AccountFormHelp";
import type {
  AccountFormField,
  AccountFormFieldErrors,
} from "@web/routes/statements/accounts/helpers/formValidation";
import {
  normalizeVariantForPayload,
  sortBankVariants,
  variantSelectValue,
} from "@web/utils/accounts";
import type { AccountWritePayload, BankVariant } from "@web/utils/api/endpoints/accounts/types";
import { formatBankName, formatVariantLabel } from "@web/utils/banks";

type FormSectionProps = {
  form: AccountWritePayload;
  fieldErrors: AccountFormFieldErrors;
  onFormChange: (updater: (current: AccountWritePayload) => AccountWritePayload) => void;
  clearFieldError: (field: AccountFormField) => void;
};

type BankFieldsProps = FormSectionProps & {
  mode: "create" | "edit";
  loadingBanks: boolean;
  bankOptions: Map<string, BankVariant[]>;
  variantsForBank: BankVariant[];
  variantSelectDisabled: boolean;
};

export function AccountFormBankFields({
  form,
  fieldErrors,
  mode,
  loadingBanks,
  bankOptions,
  variantsForBank,
  variantSelectDisabled,
  onFormChange,
  clearFieldError,
}: BankFieldsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block space-y-1">
        <FormFieldLabel required>Bank</FormFieldLabel>
        <EncryptionFieldShell kind="server_encrypted" hasError={Boolean(fieldErrors.bank)}>
          <select
            disabled={loadingBanks || mode === "edit"}
            className="form-input"
            value={form.bank}
            onChange={(event) => {
              clearFieldError("bank");
              clearFieldError("variant");
              const bank = event.target.value;
              const sortedVariants = sortBankVariants(bankOptions.get(bank) ?? []);
              const firstVariant = sortedVariants[0]?.variant ?? null;
              onFormChange((current) => ({
                ...current,
                bank,
                variant: normalizeVariantForPayload(firstVariant),
              }));
            }}
          >
            <option value="">Select bank</option>
            {[...bankOptions.keys()].map((bank) => (
              <option key={bank} value={bank}>
                {formatBankName(bank)}
              </option>
            ))}
          </select>
        </EncryptionFieldShell>
        <FormFieldError message={fieldErrors.bank} />
      </label>

      <label className="block space-y-1">
        <FormFieldLabel required>Variant</FormFieldLabel>
        <EncryptionFieldShell kind="server_encrypted" hasError={Boolean(fieldErrors.variant)}>
          <select
            disabled={variantSelectDisabled}
            className="form-input"
            value={variantSelectValue(form.variant)}
            onChange={(event) => {
              clearFieldError("variant");
              onFormChange((current) => ({
                ...current,
                variant: normalizeVariantForPayload(event.target.value),
              }));
            }}
          >
            {!form.bank ? (
              <option value="">Select bank first</option>
            ) : (
              variantsForBank.map((item) => (
                <option key={item.key} value={variantSelectValue(item.variant)}>
                  {formatVariantLabel(item.variant) || "Default"}
                </option>
              ))
            )}
          </select>
        </EncryptionFieldShell>
        <FormFieldError message={fieldErrors.variant} />
      </label>
    </div>
  );
}

export function AccountFormDateFields({
  form,
  fieldErrors,
  onFormChange,
  clearFieldError,
}: FormSectionProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label htmlFor="account-opening-date" className="block space-y-1">
        <FormFieldLabel required>Opening Date</FormFieldLabel>
        <EncryptionFieldShell kind="server_encrypted" hasError={Boolean(fieldErrors.opening_date)}>
          <DatePickerField
            id="account-opening-date"
            embedded
            aria-label="Opening Date"
            value={form.opening_date}
            onChange={(opening_date) => {
              clearFieldError("opening_date");
              onFormChange((current) => ({ ...current, opening_date }));
            }}
          />
        </EncryptionFieldShell>
        <FormFieldError message={fieldErrors.opening_date} />
      </label>
      <label htmlFor="account-closing-date" className="block space-y-1">
        <FormFieldLabel>Closing Date</FormFieldLabel>
        <EncryptionFieldShell kind="server_encrypted" hasError={Boolean(fieldErrors.closing_date)}>
          <DatePickerField
            id="account-closing-date"
            embedded
            aria-label="Closing Date"
            isClearable
            value={form.closing_date ?? ""}
            onChange={(closing_date) => {
              clearFieldError("closing_date");
              onFormChange((current) => ({
                ...current,
                closing_date: closing_date || null,
              }));
            }}
          />
        </EncryptionFieldShell>
        <FormFieldError message={fieldErrors.closing_date} />
      </label>
    </div>
  );
}

type SecretsSectionProps = FormSectionProps & {
  mode: "create" | "edit";
  hasStoredPasswords: boolean;
  replaceStoredPasswords: boolean;
  onReplaceStoredPasswordsChange: (value: boolean) => void;
};

export function AccountFormSecretsSection({
  form,
  fieldErrors,
  mode,
  hasStoredPasswords,
  replaceStoredPasswords,
  onReplaceStoredPasswordsChange,
  onFormChange,
  clearFieldError,
}: SecretsSectionProps) {
  return (
    <>
      <label className="block space-y-1">
        <FormFieldLabel required>Account number</FormFieldLabel>
        <EncryptionFieldShell kind="e2ee" hasError={Boolean(fieldErrors.account_number)}>
          <input
            disabled={mode === "edit"}
            className="form-input"
            value={form.account_number}
            onChange={(event) => {
              clearFieldError("account_number");
              onFormChange((current) => ({
                ...current,
                account_number: event.target.value,
              }));
            }}
          />
        </EncryptionFieldShell>
        <FormFieldError message={fieldErrors.account_number} />
      </label>

      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <FormFieldLabel>Statement Password(s)</FormFieldLabel>
          <StatementPasswordsHelp />
        </div>

        {replaceStoredPasswords ? (
          <div
            role="alert"
            className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-700"
          >
            <span className="font-medium">Stored passwords will be deleted.</span> Only the
            passwords you add below will be kept when you save.
          </div>
        ) : null}

        <StringListField
          values={form.passwords}
          inputType="password"
          maskListedValues
          encryptionKind="server_encrypted"
          encryptionHasError={Boolean(fieldErrors.passwords)}
          placeholder={
            mode === "edit" && hasStoredPasswords && !replaceStoredPasswords
              ? "Append passwords"
              : "Add passwords"
          }
          inputFooter={
            mode === "edit" && hasStoredPasswords ? (
              <button
                type="button"
                className={
                  replaceStoredPasswords
                    ? "text-xs font-medium text-slate-600 transition hover:text-slate-900"
                    : "text-xs font-medium text-slate-500 transition hover:text-slate-700"
                }
                onClick={() => {
                  onReplaceStoredPasswordsChange(!replaceStoredPasswords);
                }}
              >
                {replaceStoredPasswords
                  ? "Append to stored passwords instead"
                  : "Replace all stored passwords"}
              </button>
            ) : undefined
          }
          onChange={(passwords) => {
            clearFieldError("passwords");
            onFormChange((current) => ({ ...current, passwords }));
          }}
        />
        <p className="text-xs text-slate-500">
          Optional. Leave blank for unencrypted statement files.
        </p>
        <FormFieldError message={fieldErrors.passwords} />
      </div>
    </>
  );
}

type AdvancedSectionProps = FormSectionProps & {
  advancedOpen: boolean;
  onAdvancedOpenChange: (open: boolean) => void;
};

export function AccountFormAdvancedSection({
  form,
  advancedOpen,
  onAdvancedOpenChange,
  onFormChange,
}: AdvancedSectionProps) {
  return (
    <details
      className="rounded-sm border border-slate-200 bg-slate-50/60"
      open={advancedOpen}
      onToggle={(event) => {
        onAdvancedOpenChange(event.currentTarget.open);
      }}
    >
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-slate-700">
        Advanced options
      </summary>
      <div className="space-y-3 border-t border-slate-200 px-3 py-3">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-slate-700">Statement Rules</span>
            <StatementMatchingHelp />
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <span className="text-xs font-medium text-slate-500">Must Contain</span>
              <StringListField
                values={form.statement?.text_contains ?? []}
                placeholder="Add a phrase"
                encryptionKind="server_encrypted"
                onChange={(text_contains) => {
                  onFormChange((current) => ({
                    ...current,
                    statement: {
                      ...current.statement,
                      text_contains,
                      text_not_contains: current.statement?.text_not_contains ?? [],
                    },
                  }));
                }}
              />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-medium text-slate-500">Must Not Contain</span>
              <StringListField
                values={form.statement?.text_not_contains ?? []}
                placeholder="Add a phrase"
                encryptionKind="server_encrypted"
                onChange={(text_not_contains) => {
                  onFormChange((current) => ({
                    ...current,
                    statement: {
                      text_contains: current.statement?.text_contains ?? [],
                      text_not_contains,
                    },
                  }));
                }}
              />
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-slate-700">Email Rules</span>
            <MailMatchingHelp />
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <span className="text-xs font-medium text-slate-500">From Addresses</span>
              <StringListField
                values={form.mail?.from ?? []}
                placeholder="Add a from address"
                encryptionKind="server_encrypted"
                onChange={(from) => {
                  onFormChange((current) => ({
                    ...current,
                    mail: {
                      subjects: current.mail?.subjects ?? [],
                      body_contains: current.mail?.body_contains ?? [],
                      from,
                    },
                  }));
                }}
              />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-medium text-slate-500">Email Subjects</span>
              <StringListField
                values={form.mail?.subjects ?? []}
                placeholder="Add a subject phrase"
                encryptionKind="server_encrypted"
                onChange={(subjects) => {
                  onFormChange((current) => ({
                    ...current,
                    mail: {
                      subjects,
                      body_contains: current.mail?.body_contains ?? [],
                      from: current.mail?.from ?? [],
                    },
                  }));
                }}
              />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-medium text-slate-500">Email Body Contains</span>
              <StringListField
                values={form.mail?.body_contains ?? []}
                placeholder="Add a body phrase"
                encryptionKind="server_encrypted"
                onChange={(body_contains) => {
                  onFormChange((current) => ({
                    ...current,
                    mail: {
                      subjects: current.mail?.subjects ?? [],
                      body_contains,
                      from: current.mail?.from ?? [],
                    },
                  }));
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </details>
  );
}
