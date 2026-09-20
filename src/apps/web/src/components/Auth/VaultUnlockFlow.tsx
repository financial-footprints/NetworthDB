import { MfaVerifyActions } from "@web/components/Auth/MfaVerifyActions";
import { PrimaryButton, SecondaryButton } from "@web/components/Button";
import { FormErrorSummary } from "@web/components/Fields/FormErrorSummary";
import { FormRow } from "@web/components/Fields/FormRow";
import { PasswordInput } from "@web/components/Fields/PasswordInput";
import { useAuth } from "@web/contexts/Auth/Context";
import type { MeResponse } from "@web/utils/api/routes/auth/types";
import {
  authenticateVaultPrf,
  type UnlockMethod,
  unlockVaultManual,
} from "@web/utils/crypto/vault";
import { errorMessage } from "@web/utils/errors";
import { type Dispatch, type SetStateAction, type SubmitEvent, useMemo, useState } from "react";

type VaultUnlockFlowProps = {
  methods: UnlockMethod[];
  me: MeResponse;
  onComplete: () => void;
  onErrorMessagesChange?: (messages: string[]) => void;
};

const METHOD_LABELS: Record<UnlockMethod, string> = {
  password: "Vault password",
  recovery_phrase: "Recovery phrase",
  webauthn: "Passkey",
};

type VaultUnlockHeaderProps = {
  title?: string;
  description: string;
};

function VaultUnlockHeader({
  title = "Unlock your encrypted data",
  description,
}: VaultUnlockHeaderProps) {
  return (
    <div>
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
    </div>
  );
}

type VaultMethodPickerProps = {
  methods: UnlockMethod[];
  errorMessages: string[];
  onSelectMethod: (method: UnlockMethod) => void;
};

function VaultMethodPicker({ methods, errorMessages, onSelectMethod }: VaultMethodPickerProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <VaultUnlockHeader description="Choose one of your registered vault keys to continue." />
      {errorMessages.length > 0 ? <FormErrorSummary title="" messages={errorMessages} /> : null}
      <div className="space-y-2">
        {methods.map((method) => (
          <SecondaryButton
            key={method}
            type="button"
            className="w-full justify-center"
            onClick={() => onSelectMethod(method)}
          >
            {METHOD_LABELS[method]}
          </SecondaryButton>
        ))}
      </div>
    </div>
  );
}

function createVaultBackHandler(
  methods: UnlockMethod[],
  setSelectedMethod: Dispatch<SetStateAction<UnlockMethod | null>>,
  resetField: () => void,
  reportErrors: (messages: string[]) => void
) {
  if (methods.length <= 1) {
    return undefined;
  }
  return () => {
    setSelectedMethod(null);
    resetField();
    reportErrors([]);
  };
}

type VaultPasswordUnlockFormProps = {
  password: string;
  submitting: boolean;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  onBack?: () => void;
};

function VaultPasswordUnlockForm({
  password,
  submitting,
  onPasswordChange,
  onSubmit,
  onBack,
}: VaultPasswordUnlockFormProps) {
  return (
    <form className="flex min-h-0 flex-1 flex-col gap-4" onSubmit={onSubmit} noValidate>
      <FormRow label="Vault Password" htmlFor="vault-unlock-password" required>
        <PasswordInput
          id="vault-unlock-password"
          name="vault-password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          disabled={submitting}
        />
      </FormRow>
      <MfaVerifyActions
        onBack={onBack}
        backDisabled={submitting}
        primary={{
          label: "Unlock",
          submittingLabel: "Unlocking…",
          submitting,
        }}
      />
    </form>
  );
}

type VaultRecoveryUnlockFormProps = {
  recoveryPhrase: string;
  submitting: boolean;
  onPhraseChange: (value: string) => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  onBack?: () => void;
};

function VaultRecoveryUnlockForm({
  recoveryPhrase,
  submitting,
  onPhraseChange,
  onSubmit,
  onBack,
}: VaultRecoveryUnlockFormProps) {
  return (
    <form className="flex min-h-0 flex-1 flex-col gap-4" onSubmit={onSubmit} noValidate>
      <FormRow
        label="Recovery Phrase"
        htmlFor="vault-unlock-phrase"
        required
        info="Enter the 12-word recovery phrase you saved when you created this vault key."
        infoAriaLabel="Recovery phrase help"
      >
        <textarea
          id="vault-unlock-phrase"
          name="recovery-phrase"
          rows={3}
          value={recoveryPhrase}
          onChange={(event) => onPhraseChange(event.target.value)}
          disabled={submitting}
          className="form-input min-h-24 resize-y"
          autoComplete="off"
          spellCheck={false}
        />
      </FormRow>
      <MfaVerifyActions
        onBack={onBack}
        backDisabled={submitting}
        primary={{
          label: "Unlock",
          submittingLabel: "Unlocking…",
          submitting,
        }}
      />
    </form>
  );
}

type VaultPasskeyUnlockPanelProps = {
  methods: UnlockMethod[];
  submitting: boolean;
  onUnlock: () => void;
  onBack: () => void;
};

function VaultPasskeyUnlockPanel({
  methods,
  submitting,
  onUnlock,
  onBack,
}: VaultPasskeyUnlockPanelProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <p className="text-sm text-slate-600">
        Use a passkey that was registered as a vault recovery key.
      </p>
      <div className="mt-auto flex flex-col gap-2 sm:flex-row sm:justify-end">
        {methods.length > 1 ? (
          <SecondaryButton type="button" disabled={submitting} onClick={onBack}>
            Back
          </SecondaryButton>
        ) : null}
        <PrimaryButton
          type="button"
          disabled={submitting}
          aria-busy={submitting}
          onClick={onUnlock}
        >
          {submitting ? "Waiting for passkey…" : "Use passkey"}
        </PrimaryButton>
      </div>
    </div>
  );
}

export function VaultUnlockFlow({
  methods,
  me,
  onComplete,
  onErrorMessagesChange,
}: VaultUnlockFlowProps) {
  const { completeVaultUnlock } = useAuth();
  const [selectedMethod, setSelectedMethod] = useState<UnlockMethod | null>(
    methods.length === 1 ? methods[0] : null
  );
  const [password, setPassword] = useState("");
  const [recoveryPhrase, setRecoveryPhrase] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);

  const slots = useMemo(() => me.vaultSlots, [me.vaultSlots]);
  const prfSlots = useMemo(
    () => me.vaultSlots.filter((slot) => slot.slotType === "webauthn_prf"),
    [me.vaultSlots]
  );

  function reportErrors(messages: string[]) {
    setErrorMessages(messages);
    onErrorMessagesChange?.(messages);
  }

  async function finishUnlock(dek: CryptoKey) {
    await completeVaultUnlock(dek, me);
    reportErrors([]);
    onComplete();
  }

  async function handlePasswordSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password) {
      reportErrors(["Vault password is required."]);
      return;
    }
    setSubmitting(true);
    reportErrors([]);
    try {
      const dek = await unlockVaultManual(slots, { password });
      await finishUnlock(dek);
    } catch (error) {
      reportErrors([errorMessage(error, "Could not unlock your vault. Check your password.")]);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRecoverySubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const phrase = recoveryPhrase.trim();
    if (!phrase) {
      reportErrors(["Recovery phrase is required."]);
      return;
    }
    setSubmitting(true);
    reportErrors([]);
    try {
      const dek = await unlockVaultManual(slots, { recoveryPhrase: phrase });
      await finishUnlock(dek);
    } catch (error) {
      reportErrors([
        errorMessage(error, "Could not unlock your vault. Check your recovery phrase."),
      ]);
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePasskeyUnlock() {
    setSubmitting(true);
    reportErrors([]);
    try {
      const webauthn = await authenticateVaultPrf(prfSlots);
      const dek = await unlockVaultManual(slots, { webauthn });
      await finishUnlock(dek);
    } catch (error) {
      if (error instanceof Error && error.name === "NotAllowedError") {
        reportErrors(["Passkey unlock was cancelled."]);
        return;
      }
      reportErrors([errorMessage(error, "Could not unlock your vault with this passkey.")]);
    } finally {
      setSubmitting(false);
    }
  }

  function handleSelectMethod(method: UnlockMethod) {
    reportErrors([]);
    setSelectedMethod(method);
  }

  function handlePasskeyBack() {
    setSelectedMethod(null);
    reportErrors([]);
  }

  const passwordBack = createVaultBackHandler(
    methods,
    setSelectedMethod,
    () => setPassword(""),
    reportErrors
  );
  const recoveryBack = createVaultBackHandler(
    methods,
    setSelectedMethod,
    () => setRecoveryPhrase(""),
    reportErrors
  );

  if (!selectedMethod) {
    return (
      <VaultMethodPicker
        methods={methods}
        errorMessages={errorMessages}
        onSelectMethod={handleSelectMethod}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <VaultUnlockHeader description="Your account is signed in. Unlock your vault to access encrypted data in this tab." />

      {errorMessages.length > 0 ? <FormErrorSummary title="" messages={errorMessages} /> : null}

      {selectedMethod === "password" ? (
        <VaultPasswordUnlockForm
          password={password}
          submitting={submitting}
          onPasswordChange={setPassword}
          onSubmit={handlePasswordSubmit}
          onBack={passwordBack}
        />
      ) : null}

      {selectedMethod === "recovery_phrase" ? (
        <VaultRecoveryUnlockForm
          recoveryPhrase={recoveryPhrase}
          submitting={submitting}
          onPhraseChange={setRecoveryPhrase}
          onSubmit={handleRecoverySubmit}
          onBack={recoveryBack}
        />
      ) : null}

      {selectedMethod === "webauthn" ? (
        <VaultPasskeyUnlockPanel
          methods={methods}
          submitting={submitting}
          onUnlock={() => {
            void handlePasskeyUnlock();
          }}
          onBack={handlePasskeyBack}
        />
      ) : null}
    </div>
  );
}
