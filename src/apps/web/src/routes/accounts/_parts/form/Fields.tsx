import { PrimaryButton, SecondaryButton } from "@web/components/Button";
import { FormErrorSummary } from "@web/components/Fields/FormErrorSummary";
import {
  Advanced,
  BankFields,
  DateFields,
  Secrets,
  TypeField,
} from "@web/routes/accounts/_parts/form/Sections";
import {
  ACCOUNT_FORM_CONSOLE_HINT,
  type AccountFormField,
  type AccountFormFieldErrors,
} from "@web/routes/accounts/_parts/form/validation";
import { emptyForm } from "@web/utils/accounts";
import type {
  AccountType,
  AccountWritePayload,
  BankVariant,
} from "@web/utils/api/routes/accounts/types";
import type { RefObject, SubmitEvent } from "react";

type AccountFormModalFormProps = {
  mode: "create" | "edit";
  saving: boolean;
  showAccountTypePicker: boolean;
  effectiveAccountType: AccountType;
  statementCapable: boolean;
  form: AccountWritePayload;
  fieldErrors: AccountFormFieldErrors;
  errorMessages: string[];
  errorConsoleHint: boolean;
  errorSummaryRef: RefObject<HTMLDivElement | null>;
  loadingBanks: boolean;
  bankOptions: Map<string, BankVariant[]>;
  variantsForBank: BankVariant[];
  variantSelectDisabled: boolean;
  hasStoredPasswords: boolean;
  replaceStoredPasswords: boolean;
  advancedOpen: boolean;
  onClose: () => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  onFormChange: (updater: (current: AccountWritePayload) => AccountWritePayload) => void;
  clearFieldError: (field: AccountFormField) => void;
  onReplaceStoredPasswordsChange: (value: boolean) => void;
  onAdvancedOpenChange: (open: boolean) => void;
  onFieldErrorsClear: () => void;
  onErrorConsoleHintClear: () => void;
};

export function Fields({
  mode,
  saving,
  showAccountTypePicker,
  effectiveAccountType,
  statementCapable,
  form,
  fieldErrors,
  errorMessages,
  errorConsoleHint,
  errorSummaryRef,
  loadingBanks,
  bankOptions,
  variantsForBank,
  variantSelectDisabled,
  hasStoredPasswords,
  replaceStoredPasswords,
  advancedOpen,
  onClose,
  onSubmit,
  onFormChange,
  clearFieldError,
  onReplaceStoredPasswordsChange,
  onAdvancedOpenChange,
  onFieldErrorsClear,
  onErrorConsoleHintClear,
}: AccountFormModalFormProps) {
  return (
    <form className="space-y-3" noValidate onSubmit={(event) => void onSubmit(event)}>
      {errorMessages.length > 0 ? (
        <div ref={errorSummaryRef}>
          <FormErrorSummary
            messages={errorMessages}
            footnote={errorConsoleHint ? ACCOUNT_FORM_CONSOLE_HINT : undefined}
          />
        </div>
      ) : null}

      {showAccountTypePicker ? (
        <TypeField
          accountType={effectiveAccountType}
          onAccountTypeChange={(nextType) => {
            onFieldErrorsClear();
            onErrorConsoleHintClear();
            onAdvancedOpenChange(false);
            onFormChange(() => emptyForm(nextType));
          }}
        />
      ) : null}

      <BankFields
        form={form}
        fieldErrors={fieldErrors}
        mode={mode}
        loadingBanks={loadingBanks}
        bankOptions={bankOptions}
        variantsForBank={variantsForBank}
        variantSelectDisabled={variantSelectDisabled}
        freeform={!statementCapable}
        onFormChange={onFormChange}
        clearFieldError={clearFieldError}
      />

      <DateFields
        form={form}
        fieldErrors={fieldErrors}
        onFormChange={onFormChange}
        clearFieldError={clearFieldError}
      />

      {statementCapable ? (
        <>
          <Secrets
            form={form}
            fieldErrors={fieldErrors}
            mode={mode}
            hasStoredPasswords={hasStoredPasswords}
            replaceStoredPasswords={replaceStoredPasswords}
            onReplaceStoredPasswordsChange={onReplaceStoredPasswordsChange}
            onFormChange={onFormChange}
            clearFieldError={clearFieldError}
          />

          <Advanced
            form={form}
            fieldErrors={fieldErrors}
            advancedOpen={advancedOpen}
            onAdvancedOpenChange={onAdvancedOpenChange}
            onFormChange={onFormChange}
            clearFieldError={clearFieldError}
          />
        </>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2 pt-1">
        <SecondaryButton type="button" onClick={onClose} disabled={saving}>
          Cancel
        </SecondaryButton>
        <PrimaryButton type="submit" disabled={saving} aria-busy={saving}>
          {saving ? "Saving…" : "Save"}
        </PrimaryButton>
      </div>
    </form>
  );
}
