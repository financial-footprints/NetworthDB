import { Dialog } from "@web/components/Modal/Dialog";
import { useNotifications } from "@web/contexts/Notifications/Context";
import { Fields } from "@web/routes/accounts/_parts/form/Fields";
import {
  runAccountFormSubmit,
  useAccountFormBanks,
} from "@web/routes/accounts/_parts/form/helpers";
import {
  type AccountFormField,
  type AccountFormFieldErrors,
  accountFormErrorMessages,
  validateRequiredAccountFields,
} from "@web/routes/accounts/_parts/form/validation";
import { emptyForm, hasAdvancedOptions, sortBankVariants } from "@web/utils/accounts";
import { accountToFormPayload } from "@web/utils/api/routes/accounts";
import type {
  Account,
  AccountType,
  AccountWritePayload,
  BankVariant,
} from "@web/utils/api/routes/accounts/types";
import { supportsStatements } from "@web/utils/api/routes/accounts/types";
import { type SubmitEvent, useMemo, useRef, useState } from "react";

type AccountFormModalProps = {
  accountType: AccountType;
  mode: "create" | "edit";
  pickAccountType?: boolean;
  initialAccount?: Account;
  accountId?: string;
  onClose: () => void;
  onSaved: () => void;
};

export function Modal({
  accountType,
  mode,
  pickAccountType = false,
  initialAccount,
  accountId,
  onClose,
  onSaved,
}: AccountFormModalProps) {
  const showAccountTypePicker = mode === "create" && pickAccountType;
  const { pushNotification } = useNotifications();
  const [saving, setSaving] = useState(false);
  const initialFormRef = useRef<AccountWritePayload | null>(null);
  if (initialFormRef.current === null) {
    const createType = showAccountTypePicker ? "bank" : accountType;
    initialFormRef.current = initialAccount
      ? accountToFormPayload(initialAccount, accountType)
      : emptyForm(createType);
  }
  const [form, setForm] = useState<AccountWritePayload>(
    () => initialFormRef.current as AccountWritePayload
  );
  const effectiveAccountType: AccountType =
    mode === "edit" ? accountType : showAccountTypePicker ? form.type : accountType;
  const { banks, loadingBanks } = useAccountFormBanks(effectiveAccountType, pushNotification);
  const statementCapable = supportsStatements(effectiveAccountType);
  const [hasStoredPasswords] = useState(() => initialAccount?.hasPasswords ?? false);
  const [replaceStoredPasswords, setReplaceStoredPasswords] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(
    () =>
      initialAccount !== undefined &&
      (initialAccount.hasMailSettings === true ||
        initialAccount.hasStatementRules === true ||
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
    <Dialog
      open
      onClose={onClose}
      busy={saving}
      size="lg"
      title={mode === "create" ? "Add Account" : "Edit Account"}
      panelClassName="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-sm border border-slate-200 bg-white p-5 shadow-xl"
    >
      <Fields
        mode={mode}
        saving={saving}
        showAccountTypePicker={showAccountTypePicker}
        effectiveAccountType={effectiveAccountType}
        statementCapable={statementCapable}
        form={form}
        fieldErrors={fieldErrors}
        errorMessages={errorMessages}
        errorConsoleHint={errorConsoleHint}
        errorSummaryRef={errorSummaryRef}
        loadingBanks={loadingBanks}
        bankOptions={bankOptions}
        variantsForBank={variantsForBank}
        variantSelectDisabled={variantSelectDisabled}
        hasStoredPasswords={hasStoredPasswords}
        replaceStoredPasswords={replaceStoredPasswords}
        advancedOpen={advancedOpen}
        onClose={onClose}
        onSubmit={handleSubmit}
        onFormChange={setForm}
        clearFieldError={clearFieldError}
        onReplaceStoredPasswordsChange={setReplaceStoredPasswords}
        onAdvancedOpenChange={setAdvancedOpen}
        onFieldErrorsClear={() => setFieldErrors({})}
        onErrorConsoleHintClear={() => setErrorConsoleHint(false)}
      />
    </Dialog>
  );
}
