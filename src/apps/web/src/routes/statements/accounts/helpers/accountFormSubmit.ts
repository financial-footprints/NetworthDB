import {
  type AccountFormFieldErrors,
  mapApiErrorToFormErrors,
} from "@web/routes/statements/accounts/helpers/formValidation";
import { toAccountUpdatePayload } from "@web/utils/accounts";
import { createAccount, updateAccount } from "@web/utils/api/endpoints/accounts";
import type { AccountWritePayload } from "@web/utils/api/endpoints/accounts/types";
import { ApiError } from "@web/utils/api/types";
import { errorMessage } from "@web/utils/errors";

export async function submitAccountForm(
  mode: "create" | "edit",
  form: AccountWritePayload,
  accountId?: string
): Promise<void> {
  if (mode === "create") {
    await createAccount(form);
    return;
  }
  if (accountId) {
    await updateAccount(accountId, toAccountUpdatePayload(form));
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

export function accountFormSubmitErrorMessage(error: unknown): string {
  return errorMessage(error, "Could not save account");
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
      onNotify(accountFormSubmitErrorMessage(error));
    }
  } finally {
    if (isCurrentGeneration(submitGeneration)) {
      setSaving(false);
    }
  }
}
