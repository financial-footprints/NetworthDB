import { PrimaryButton, SecondaryButton } from "@web/components/button";
import { FormErrorSummary } from "@web/components/fields/FormErrorSummary";
import { useNotifications } from "@web/context/Notifications/NotificationContext";
import { AccountFormRequiredHelp } from "@web/routes/statements/accounts/AccountFormHelp";
import {
  AccountFormAdvancedSection,
  AccountFormBankFields,
  AccountFormDateFields,
  AccountFormSecretsSection,
} from "@web/routes/statements/accounts/AccountFormSections";
import { runAccountFormSubmit } from "@web/routes/statements/accounts/helpers/accountFormSubmit";
import {
  ACCOUNT_FORM_CONSOLE_HINT,
  type AccountFormField,
  type AccountFormFieldErrors,
  accountFormErrorMessages,
  validateRequiredAccountFields,
} from "@web/routes/statements/accounts/helpers/formValidation";
import { emptyForm, hasAdvancedOptions, sortBankVariants } from "@web/utils/accounts";
import { accountToFormPayload, readBanks } from "@web/utils/api/endpoints/accounts";
import type {
  Account,
  AccountType,
  AccountWritePayload,
  BankVariant,
} from "@web/utils/api/endpoints/accounts/types";
import { OVERLAY_Z } from "@web/utils/constant";
import { errorMessage } from "@web/utils/errors";
import { type SubmitEvent, useEffect, useMemo, useRef, useState } from "react";

type AccountFormModalProps = {
  accountType: AccountType;
  mode: "create" | "edit";
  initialAccount?: Account;
  accountId?: string;
  onClose: () => void;
  onSaved: () => void;
};

export function AccountFormModal({
  accountType,
  mode,
  initialAccount,
  accountId,
  onClose,
  onSaved,
}: AccountFormModalProps) {
  const { pushNotification } = useNotifications();
  const [banks, setBanks] = useState<BankVariant[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(true);
  const [saving, setSaving] = useState(false);
  const initialFormRef = useRef<AccountWritePayload | null>(null);
  if (initialFormRef.current === null) {
    initialFormRef.current = initialAccount
      ? accountToFormPayload(initialAccount, accountType)
      : emptyForm(accountType);
  }
  const [form, setForm] = useState<AccountWritePayload>(
    () => initialFormRef.current as AccountWritePayload
  );
  const [hasStoredPasswords] = useState(() => initialAccount?.has_passwords ?? false);
  const [replaceStoredPasswords, setReplaceStoredPasswords] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(
    () =>
      initialAccount !== undefined &&
      (initialAccount.has_mail_settings === true ||
        initialAccount.has_statement_rules === true ||
        hasAdvancedOptions(initialFormRef.current as AccountWritePayload))
  );
  const [fieldErrors, setFieldErrors] = useState<AccountFormFieldErrors>({});
  const [errorConsoleHint, setErrorConsoleHint] = useState(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const submitGenerationRef = useRef(0);

  function clearFieldError(field: AccountFormField) {
    setFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function showValidationErrors(
    errors: AccountFormFieldErrors,
    options?: { showConsoleHint?: boolean }
  ) {
    setFieldErrors(errors);
    setErrorConsoleHint(options?.showConsoleHint ?? false);
    requestAnimationFrame(() => {
      errorSummaryRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
  }

  useEffect(() => {
    let cancelled = false;

    void readBanks()
      .then((response) => {
        if (cancelled) {
          return;
        }
        setBanks(response.items.filter((bank) => bank.account_type === accountType));
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          pushNotification(errorMessage(error, "Could not load banks"), "error");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingBanks(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [accountType, pushNotification]);

  const bankOptions = useMemo(() => {
    const grouped = new Map<string, BankVariant[]>();
    for (const bank of banks) {
      const items = grouped.get(bank.bank) ?? [];
      items.push(bank);
      grouped.set(bank.bank, items);
    }
    return grouped;
  }, [banks]);

  const variantsForBank = sortBankVariants(bankOptions.get(form.bank) ?? []);
  const variantSelectDisabled = !form.bank || loadingBanks || mode === "edit";

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (saving) {
      return;
    }

    const requiredErrors = validateRequiredAccountFields(form, {
      variantsForBank,
    });
    if (Object.keys(requiredErrors).length > 0) {
      showValidationErrors(requiredErrors);
      return;
    }

    setFieldErrors({});
    setErrorConsoleHint(false);
    const submitGeneration = ++submitGenerationRef.current;
    setSaving(true);

    await runAccountFormSubmit({
      mode,
      form,
      accountId,
      submitGeneration,
      isCurrentGeneration: (generation) => generation === submitGenerationRef.current,
      onSuccess: () => {
        onSaved();
        onClose();
      },
      onValidationErrors: (errors, showConsoleHint) => {
        showValidationErrors(errors, { showConsoleHint });
      },
      onNotify: (message) => {
        pushNotification(message, "error");
      },
      setSaving,
    });
  }

  const errorMessages = accountFormErrorMessages(fieldErrors);

  return (
    <div
      className={`fixed inset-0 ${OVERLAY_Z} flex items-center justify-center bg-slate-900/40 p-4`}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-sm border border-slate-200 bg-white p-5 shadow-xl"
      >
        <div className="mb-4 flex items-center gap-1.5">
          <h2 className="text-lg font-semibold text-slate-900">
            {mode === "create" ? "Add Account" : "Edit Account"}
          </h2>
          {mode === "create" ? <AccountFormRequiredHelp /> : null}
        </div>

        <form className="space-y-3" noValidate onSubmit={(event) => void handleSubmit(event)}>
          {errorMessages.length > 0 ? (
            <div ref={errorSummaryRef}>
              <FormErrorSummary
                messages={errorMessages}
                footnote={errorConsoleHint ? ACCOUNT_FORM_CONSOLE_HINT : undefined}
              />
            </div>
          ) : null}

          <AccountFormBankFields
            form={form}
            fieldErrors={fieldErrors}
            mode={mode}
            loadingBanks={loadingBanks}
            bankOptions={bankOptions}
            variantsForBank={variantsForBank}
            variantSelectDisabled={variantSelectDisabled}
            onFormChange={setForm}
            clearFieldError={clearFieldError}
          />

          <AccountFormDateFields
            form={form}
            fieldErrors={fieldErrors}
            onFormChange={setForm}
            clearFieldError={clearFieldError}
          />

          <AccountFormSecretsSection
            form={form}
            fieldErrors={fieldErrors}
            mode={mode}
            hasStoredPasswords={hasStoredPasswords}
            replaceStoredPasswords={replaceStoredPasswords}
            onReplaceStoredPasswordsChange={setReplaceStoredPasswords}
            onFormChange={setForm}
            clearFieldError={clearFieldError}
          />

          <AccountFormAdvancedSection
            form={form}
            fieldErrors={fieldErrors}
            advancedOpen={advancedOpen}
            onAdvancedOpenChange={setAdvancedOpen}
            onFormChange={setForm}
            clearFieldError={clearFieldError}
          />

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <SecondaryButton type="button" onClick={onClose} disabled={saving}>
              Cancel
            </SecondaryButton>
            <PrimaryButton type="submit" disabled={saving} aria-busy={saving}>
              {saving ? "Saving…" : "Save"}
            </PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
}
