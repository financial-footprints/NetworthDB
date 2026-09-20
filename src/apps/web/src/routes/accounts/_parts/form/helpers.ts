import {
  type AccountFormFieldErrors,
  mapApiErrorToFormErrors,
} from "@web/routes/accounts/_parts/form/validation";
import { createAccount, readBanks, updateAccount } from "@web/utils/api/routes/accounts";
import type {
  AccountType,
  AccountWritePayload,
  BankVariant,
} from "@web/utils/api/routes/accounts/types";
import { ApiError } from "@web/utils/api/types";
import { errorMessage } from "@web/utils/errors";
import { useEffect, useState } from "react";

async function submitAccountForm(
  mode: "create" | "edit",
  form: AccountWritePayload,
  accountId?: string
): Promise<void> {
  if (mode === "create") {
    await createAccount(form);
    return;
  }
  if (accountId) {
    await updateAccount(accountId, form);
  }
}

export function mapAccountFormSubmitError(
  error: unknown,
  mode: "create" | "edit"
): { fieldErrors: AccountFormFieldErrors; showConsoleHint: boolean; notify: boolean } {
  const { errors: fieldErrors, showConsoleHint } = mapApiErrorToFormErrors(error, { mode });
  const notify =
    !(error instanceof ApiError) ||
    (error.status !== 422 && error.status !== 400 && error.status !== 409);
  return { fieldErrors, showConsoleHint, notify };
}

type RunAccountFormSubmitParams = {
  mode: "create" | "edit";
  form: AccountWritePayload;
  accountId?: string;
  submitGeneration: number;
  isCurrentGeneration: (generation: number) => boolean;
  onSuccess: () => void;
  onValidationErrors: (errors: AccountFormFieldErrors, showConsoleHint: boolean) => void;
  onNotify: (message: string) => void;
  setSaving: (saving: boolean) => void;
};

export async function runAccountFormSubmit({
  mode,
  form,
  accountId,
  submitGeneration,
  isCurrentGeneration,
  onSuccess,
  onValidationErrors,
  onNotify,
  setSaving,
}: RunAccountFormSubmitParams): Promise<void> {
  try {
    await submitAccountForm(mode, form, accountId);
    if (!isCurrentGeneration(submitGeneration)) {
      return;
    }
    onSuccess();
  } catch (error) {
    if (!isCurrentGeneration(submitGeneration)) {
      return;
    }
    const mapped = mapAccountFormSubmitError(error, mode);
    onValidationErrors(mapped.fieldErrors, mapped.showConsoleHint);
    if (mapped.notify) {
      onNotify(errorMessage(error, "Could not save account"));
    }
  } finally {
    if (isCurrentGeneration(submitGeneration)) {
      setSaving(false);
    }
  }
}

export function useAccountFormBanks(
  effectiveAccountType: AccountType,
  pushNotification: (message: string, variant?: "error" | "info" | "warning") => void
): { banks: BankVariant[]; loadingBanks: boolean } {
  const [banks, setBanks] = useState<BankVariant[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoadingBanks(true);

    void readBanks()
      .then((response) => {
        if (cancelled) {
          return;
        }
        setBanks(response.items.filter((bank) => bank.accountType === effectiveAccountType));
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
  }, [effectiveAccountType, pushNotification]);

  return { banks, loadingBanks };
}
