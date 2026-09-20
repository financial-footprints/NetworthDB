import { log } from "@web/logging";
import type { AccountWritePayload } from "@web/utils/api/routes/accounts/types";
import { ApiError, type ValidationDetails } from "@web/utils/api/types";
import { MIN_ACCOUNT_DATE, maxAccountDateLabel, validateAccountDateInput } from "@web/utils/time";

const MIN_ACCOUNT_DATE_MESSAGE = `Only dates on or after ${MIN_ACCOUNT_DATE} are accepted.`;
const MAX_ACCOUNT_DATE_MESSAGE = `Only dates through ${maxAccountDateLabel()} are accepted.`;
const INVALID_ACCOUNT_DATE_MESSAGE = "Enter a valid calendar date in DD-MM-YYYY format.";

export type AccountFormField =
  | "bank"
  | "variant"
  | "account_number"
  | "passwords"
  | "opening_date"
  | "closing_date"
  | "form";

export type AccountFormFieldErrors = Partial<Record<AccountFormField, string>>;

type AccountFormErrorResult = {
  errors: AccountFormFieldErrors;
  showConsoleHint: boolean;
};

export const ACCOUNT_FORM_CONSOLE_HINT = "Technical details are logged in the browser console.";

const GENERIC_SAVE_ERROR = "Could not save account. Please check the fields below and try again.";

const FIELD_LABELS: Record<AccountFormField, string> = {
  bank: "Bank",
  variant: "Variant",
  account_number: "Account number",
  passwords: "Statement Password(s)",
  opening_date: "Opening date",
  closing_date: "Closing date",
  form: "Account",
};

const FORM_FIELDS = new Set<AccountFormField>([
  "bank",
  "variant",
  "account_number",
  "passwords",
  "opening_date",
  "closing_date",
]);

const API_FIELD_PATTERNS: Array<{ pattern: RegExp; field: AccountFormField }> = [
  { pattern: /\bbank\b/i, field: "bank" },
  { pattern: /\bvariant\b/i, field: "variant" },
  { pattern: /\baccount_number\b/i, field: "account_number" },
  { pattern: /\bpasswords?\b/i, field: "passwords" },
  { pattern: /\bopening_date\b/i, field: "opening_date" },
  { pattern: /\bclosing_date\b/i, field: "closing_date" },
];

const FIELD_MESSAGE_BEAUTIFIERS: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /must be in DD-MM-YYYY format/i,
    message: "Use DD-MM-YYYY format (for example, 01-04-2023).",
  },
  {
    pattern: /must be on or after opening_date/i,
    message: "Must be on or after the opening date.",
  },
  {
    pattern: /is not a valid calendar date/i,
    message: "Enter a valid calendar date.",
  },
  { pattern: /^bank is required\.?$/i, message: "Select a bank." },
  {
    pattern: /account_number is required/i,
    message: "Enter the account or card number.",
  },
  {
    pattern: /passwords must contain at least one/i,
    message: "Enter at least one statement password.",
  },
  {
    pattern: /opening_date is required/i,
    message: "Opening date is required.",
  },
  {
    pattern: /must be on or after 01-01-1970/i,
    message: MIN_ACCOUNT_DATE_MESSAGE,
  },
  {
    pattern: /must not be after/i,
    message: MAX_ACCOUNT_DATE_MESSAGE,
  },
  {
    pattern: /must contain at least one non-empty/i,
    message: "Enter at least one value.",
  },
  {
    pattern: /invalid from email address/i,
    message: "Enter a valid from address.",
  },
  {
    pattern: /from entries must not contain whitespace/i,
    message: "From addresses cannot contain spaces.",
  },
  {
    pattern: /account already exists/i,
    message: "An account with this number already exists.",
  },
];

function normalizeValidationMessage(message: string): string {
  return message
    .replace(/^Value error,\s*/i, "")
    .replace(/\s*\[type=[^\]]+\]/g, "")
    .replace(/\s+input_value=.*$/i, "")
    .replace(/\s+input_type=.*$/i, "")
    .trim();
}

function isTechnicalMessage(message: string): boolean {
  return (
    /\[type=|UserAccountConfig|validation errors for|invalid stored config|Pydantic|Traceback/i.test(
      message
    ) || message.length > 240
  );
}

function beautifyFieldMessage(message: string): string {
  const normalized = normalizeValidationMessage(message);

  for (const { pattern, message: friendly } of FIELD_MESSAGE_BEAUTIFIERS) {
    if (pattern.test(normalized)) {
      return friendly;
    }
  }

  return normalized;
}

function beautifyFormLevelMessage(message: string): string {
  const normalized = normalizeValidationMessage(message);

  if (/invalid stored config/i.test(normalized)) {
    return "This account could not be saved because of invalid stored data.";
  }

  if (/validation errors for UserAccountConfig/i.test(normalized)) {
    return "Some fields are invalid. Check the highlighted fields below.";
  }

  if (isTechnicalMessage(normalized)) {
    return GENERIC_SAVE_ERROR;
  }

  return beautifyFieldMessage(normalized);
}

function logAccountFormError(error: unknown): void {
  if (error instanceof ApiError) {
    log("error", "@ndb/web.accounts.form-save.failed", {
      status: error.status,
      kind: error.name,
    });
    return;
  }
  const kind = error instanceof Error ? error.name : "Error";
  log("error", "@ndb/web.accounts.form-save.failed", { kind });
}

function humanizePathSegment(segment: string): string {
  if (FORM_FIELDS.has(segment as AccountFormField)) {
    return FIELD_LABELS[segment as AccountFormField];
  }
  return segment.replace(/_/g, " ");
}

function formatValidationDetailsMessage(detail: ValidationDetails): string {
  const path = detail.loc.filter((part: string) => part !== "body");
  const message = beautifyFieldMessage(detail.msg);

  if (detail.msg === "Extra inputs are not permitted") {
    if (path.length === 0) {
      return "The request contains a field that is not allowed.";
    }
    const segments = path.map(humanizePathSegment);
    const field = segments[segments.length - 1];
    if (segments.length === 1) {
      return `"${field}" is not an allowed field. Remove it and try again.`;
    }
    return `"${field}" is not allowed in ${segments.slice(0, -1).join(" → ")}.`;
  }

  if (path.length > 0 && !message.includes(":")) {
    const label = humanizePathSegment(path[path.length - 1]);
    const friendly = beautifyFieldMessage(detail.msg);
    if (friendly.toLowerCase().startsWith(label.toLowerCase())) {
      return friendly;
    }
    return `${label}: ${friendly}`;
  }

  return message;
}

function humanizeFieldErrorMessage(field: AccountFormField, message: string): string {
  if (field === "form") {
    return beautifyFormLevelMessage(message);
  }

  const friendly = beautifyFieldMessage(message);
  const label = FIELD_LABELS[field];

  if (friendly.toLowerCase().startsWith(field.toLowerCase())) {
    return label + friendly.slice(field.length);
  }

  if (friendly.toLowerCase().startsWith(label.toLowerCase())) {
    return friendly;
  }

  return friendly;
}

function fieldFromLoc(loc: string[]): AccountFormField | null {
  const segments = loc.filter((part) => part !== "body");
  const last = segments[segments.length - 1];
  if (last && FORM_FIELDS.has(last as AccountFormField)) {
    return last as AccountFormField;
  }
  return null;
}

function fieldFromMessage(message: string): AccountFormField | null {
  for (const { pattern, field } of API_FIELD_PATTERNS) {
    if (pattern.test(message)) {
      return field;
    }
  }
  return null;
}

function accountDateFieldError(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return undefined;
  }
  const result = validateAccountDateInput(trimmed);
  if (result.ok) {
    return undefined;
  }
  if (result.reason === "too_early") {
    return MIN_ACCOUNT_DATE_MESSAGE;
  }
  if (result.reason === "too_late") {
    return MAX_ACCOUNT_DATE_MESSAGE;
  }
  return INVALID_ACCOUNT_DATE_MESSAGE;
}

export function validateRequiredAccountFields(
  form: AccountWritePayload,
  options?: {
    variantsForBank?: Array<{ variant: string | null }>;
  }
): AccountFormFieldErrors {
  const errors: AccountFormFieldErrors = {};
  const variantsForBank = options?.variantsForBank ?? [];

  if (!form.bank.trim()) {
    errors.bank = "Select a bank.";
  } else if (variantsForBank.length > 0) {
    const hasDefaultOption = variantsForBank.some(
      (item) => !item.variant || item.variant.toLowerCase() === "default"
    );
    const onlyDefault = variantsForBank.every(
      (item) => !item.variant || item.variant.toLowerCase() === "default"
    );
    const variantMissing = !form.variant || form.variant.trim() === "";
    if (!onlyDefault && variantMissing && !hasDefaultOption) {
      errors.variant = "Select a variant.";
    }
  }

  if (!form.account_number.trim()) {
    errors.account_number = "Enter the account or card number.";
  }

  if (!form.opening_date.trim()) {
    errors.opening_date = "Opening date is required.";
  } else {
    const openingDateError = accountDateFieldError(form.opening_date);
    if (openingDateError) {
      errors.opening_date = openingDateError;
    }
  }

  if (form.closing_date?.trim()) {
    const closingDateError = accountDateFieldError(form.closing_date);
    if (closingDateError) {
      errors.closing_date = closingDateError;
    }
  }

  return errors;
}

function mapMessageLineToField(line: string, errors: AccountFormFieldErrors): void {
  const normalized = normalizeValidationMessage(line);
  const colonIndex = normalized.indexOf(": ");
  const message = colonIndex >= 0 ? normalized.slice(colonIndex + 2) : normalized;
  const field =
    (colonIndex >= 0 ? fieldFromLoc(normalized.slice(0, colonIndex).split(" → ")) : null) ??
    fieldFromMessage(normalized) ??
    fieldFromMessage(message);

  if (field && field !== "form") {
    errors[field] = humanizeFieldErrorMessage(field, message);
    return;
  }

  if (!errors.form) {
    errors.form = beautifyFormLevelMessage(normalized);
  }
}

export function accountFormErrorMessages(errors: AccountFormFieldErrors): string[] {
  const orderedFields: AccountFormField[] = [
    "bank",
    "variant",
    "account_number",
    "passwords",
    "opening_date",
    "closing_date",
    "form",
  ];

  return orderedFields
    .filter((field) => errors[field])
    .map((field) => {
      const message = humanizeFieldErrorMessage(field, errors[field] ?? "");
      if (field === "form") {
        return message;
      }
      const label = FIELD_LABELS[field];
      if (message.toLowerCase().startsWith(label.toLowerCase())) {
        return message;
      }
      return `${label}: ${message}`;
    });
}

type AccountFormMode = "create" | "edit";

type MapApiErrorToFormErrorsOptions = {
  mode?: AccountFormMode;
};

const CREATE_ACCOUNT_ALREADY_EXISTS_MESSAGE =
  "An account with this number already exists. If you fixed another error and tried again, check the account list — it may have been saved on the earlier attempt.";

function mapConflictAccountError(
  error: ApiError,
  mode: AccountFormMode | undefined
): AccountFormErrorResult | null {
  if (error.status !== 409 || !/account already exists/i.test(error.message)) {
    return null;
  }
  return {
    errors: {
      account_number:
        mode === "create"
          ? CREATE_ACCOUNT_ALREADY_EXISTS_MESSAGE
          : beautifyFieldMessage(error.message),
    },
    showConsoleHint: false,
  };
}

function mapValidationDetailsToErrors(details: NonNullable<ApiError["validationDetails"]>): {
  errors: AccountFormFieldErrors;
  usedGenericFormMessage: boolean;
} {
  const errors: AccountFormFieldErrors = {};
  let usedGenericFormMessage = false;

  for (const detail of details) {
    const message = formatValidationDetailsMessage(detail);
    const field = fieldFromLoc(detail.loc) ?? fieldFromMessage(message);
    if (field) {
      errors[field] = humanizeFieldErrorMessage(field, message);
    } else if (!errors.form) {
      errors.form = beautifyFormLevelMessage(message);
      usedGenericFormMessage = usedGenericFormMessage || isTechnicalMessage(detail.msg);
    }
  }

  return { errors, usedGenericFormMessage };
}

function mapRawMessageLinesToErrors(rawMessage: string): {
  errors: AccountFormFieldErrors;
  usedGenericFormMessage: boolean;
} {
  const errors: AccountFormFieldErrors = {};
  const lines = rawMessage
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of lines) {
    mapMessageLineToField(line, errors);
  }
  return { errors, usedGenericFormMessage: lines.some(isTechnicalMessage) };
}

function buildFallbackFormError(rawMessage: string): {
  errors: AccountFormFieldErrors;
  usedGenericFormMessage: boolean;
} {
  return {
    errors: { form: beautifyFormLevelMessage(rawMessage) },
    usedGenericFormMessage: isTechnicalMessage(rawMessage),
  };
}

export function mapApiErrorToFormErrors(
  error: unknown,
  options: MapApiErrorToFormErrorsOptions = {}
): AccountFormErrorResult {
  if (!(error instanceof ApiError)) {
    logAccountFormError(error);
    return {
      errors: { form: GENERIC_SAVE_ERROR },
      showConsoleHint: true,
    };
  }

  logAccountFormError(error);

  const conflictResult = mapConflictAccountError(error, options.mode);
  if (conflictResult) {
    return conflictResult;
  }

  const rawMessage = error.message;
  let errors: AccountFormFieldErrors = {};
  let usedGenericFormMessage = false;

  if (error.validationDetails?.length) {
    const parsed = mapValidationDetailsToErrors(error.validationDetails);
    errors = parsed.errors;
    usedGenericFormMessage = parsed.usedGenericFormMessage;
  }

  if (Object.keys(errors).length === 0) {
    const parsed = mapRawMessageLinesToErrors(rawMessage);
    errors = parsed.errors;
    usedGenericFormMessage = usedGenericFormMessage || parsed.usedGenericFormMessage;
  }

  if (Object.keys(errors).length === 0) {
    const parsed = buildFallbackFormError(rawMessage);
    errors = parsed.errors;
    usedGenericFormMessage = parsed.usedGenericFormMessage;
  }

  const showConsoleHint =
    isTechnicalMessage(rawMessage) || usedGenericFormMessage || errors.form === GENERIC_SAVE_ERROR;

  return { errors, showConsoleHint };
}
