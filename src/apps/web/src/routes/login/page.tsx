import { LoginCard, LoginCardSkeleton } from "@web/components/auth/LoginCard";
import { MfaEnrollFlow } from "@web/components/auth/MfaEnrollFlow";
import { type MfaVerifyComplete, MfaVerifyFlow } from "@web/components/auth/MfaVerifyFlow";
import { VaultSetupFlow } from "@web/components/auth/VaultSetupFlow";
import { VaultUnlockFlow } from "@web/components/auth/VaultUnlockFlow";
import { PrimaryButton } from "@web/components/button";
import { FormErrorSummary } from "@web/components/fields/FormErrorSummary";
import { FormRow } from "@web/components/fields/FormRow";
import { PasswordInput } from "@web/components/fields/PasswordInput";
import { useAuth } from "@web/context/Auth/AuthContext";
import { useNotifications } from "@web/context/Notifications/NotificationContext";
import { path } from "@web/router/routes";
import type { MeResponse, TokenPair } from "@web/utils/api/endpoints/auth/types";
import { ApiError } from "@web/utils/api/types";
import { listUnlockMethods, type UnlockMethod } from "@web/utils/crypto/vault";
import { errorMessage } from "@web/utils/errors";
import { type SubmitEvent, useCallback, useEffect, useMemo, useState } from "react";
import { type Location, useLocation, useNavigate } from "react-router-dom";

type LoginLocationState = {
  from?: { pathname?: string };
  mfaEnrolled?: boolean;
  recoveryCodesGenerated?: boolean;
};

type LoginStep =
  | { kind: "credentials" }
  | { kind: "enroll"; multifactorToken: string; methods: string[] }
  | { kind: "verify"; multifactorToken: string; methods: string[] }
  | { kind: "unlock"; methods: UnlockMethod[] };

const MFA_ENROLLMENT_SUCCESS_MESSAGE =
  "Multi-factor authentication is enabled. Sign in again to continue.";

const RECOVERY_CODES_SUCCESS_MESSAGE = "Recovery codes were generated. Sign in again to continue.";

function getPostLoginPath(location: Location): string {
  return (location.state as LoginLocationState | null)?.from?.pathname ?? path.home;
}

function useLoginFlashNotifications(
  location: Location,
  navigate: ReturnType<typeof useNavigate>,
  pushNotification: ReturnType<typeof useNotifications>["pushNotification"]
) {
  const locationState = location.state as LoginLocationState | null;

  useEffect(() => {
    if (locationState?.mfaEnrolled) {
      pushNotification(MFA_ENROLLMENT_SUCCESS_MESSAGE, "success");
      navigate(location.pathname, { replace: true, state: null });
      return;
    }
    if (locationState?.recoveryCodesGenerated) {
      pushNotification(RECOVERY_CODES_SUCCESS_MESSAGE, "success");
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [
    location.pathname,
    locationState?.mfaEnrolled,
    locationState?.recoveryCodesGenerated,
    navigate,
    pushNotification,
  ]);
}

type CredentialsLoginFormProps = {
  username: string;
  password: string;
  submitting: boolean;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
};

function CredentialsLoginForm({
  username,
  password,
  submitting,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
}: CredentialsLoginFormProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center">
      <form className="space-y-5" onSubmit={onSubmit} noValidate>
        <FormRow label="Username" htmlFor="login-username" required>
          <input
            id="login-username"
            type="text"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(event) => onUsernameChange(event.target.value)}
            disabled={submitting}
            className="form-input"
          />
        </FormRow>

        <FormRow label="Password" htmlFor="login-password" required>
          <PasswordInput
            id="login-password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            disabled={submitting}
          />
        </FormRow>

        <div className="pt-1 [&_button]:flex [&_button]:w-full [&_button]:justify-center">
          <PrimaryButton type="submit" disabled={submitting} aria-busy={submitting}>
            {submitting ? "Logging in…" : "Login"}
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}

type LoginStepContentProps = {
  step: LoginStep;
  showVaultUnlock: boolean;
  showVaultSetup: boolean;
  finishingSignIn: boolean;
  me: MeResponse | null;
  unlockMethods: UnlockMethod[];
  getMfaBearerToken: () => Promise<string>;
  username: string;
  password: string;
  submitting: boolean;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onCredentialsSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  onEnrollmentComplete: (tokens: TokenPair | null) => void;
  onVerifyComplete: (result: MfaVerifyComplete) => void;
  onEnrollCancel: () => void;
  onVerifyCancel: () => void;
  onVaultUnlockComplete: () => void;
  onVaultSetupComplete: () => void;
  onVaultErrorMessagesChange: (messages: string[]) => void;
};

function LoginStepContent({
  step,
  showVaultUnlock,
  showVaultSetup,
  finishingSignIn,
  me,
  unlockMethods,
  getMfaBearerToken,
  username,
  password,
  submitting,
  onUsernameChange,
  onPasswordChange,
  onCredentialsSubmit,
  onEnrollmentComplete,
  onVerifyComplete,
  onEnrollCancel,
  onVerifyCancel,
  onVaultUnlockComplete,
  onVaultSetupComplete,
  onVaultErrorMessagesChange,
}: LoginStepContentProps) {
  if (finishingSignIn) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
        <p className="text-slate-600">Finishing sign-in…</p>
      </div>
    );
  }

  if (showVaultSetup) {
    return (
      <VaultSetupFlow
        onComplete={onVaultSetupComplete}
        onErrorMessagesChange={onVaultErrorMessagesChange}
      />
    );
  }
  if (step.kind === "enroll") {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <MfaEnrollFlow
          methods={step.methods}
          getBearerToken={getMfaBearerToken}
          onComplete={onEnrollmentComplete}
          onCancel={onEnrollCancel}
        />
      </div>
    );
  }

  if (step.kind === "verify") {
    return (
      <MfaVerifyFlow
        methods={step.methods}
        getBearerToken={getMfaBearerToken}
        onComplete={onVerifyComplete}
        onCancel={onVerifyCancel}
      />
    );
  }

  if (showVaultUnlock && me) {
    return (
      <VaultUnlockFlow
        methods={unlockMethods}
        me={me}
        onComplete={onVaultUnlockComplete}
        onErrorMessagesChange={onVaultErrorMessagesChange}
      />
    );
  }

  return (
    <CredentialsLoginForm
      username={username}
      password={password}
      submitting={submitting}
      onUsernameChange={onUsernameChange}
      onPasswordChange={onPasswordChange}
      onSubmit={onCredentialsSubmit}
    />
  );
}

export default function LoginPage() {
  const { status, vaultStatus, vaultSetupInProgress, me, login, completeLoginWithPassword } =
    useAuth();
  const { pushNotification } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [step, setStep] = useState<LoginStep>({ kind: "credentials" });

  useLoginFlashNotifications(location, navigate, pushNotification);

  useEffect(() => {
    if (status !== "authenticated" || vaultStatus !== "locked" || vaultSetupInProgress || !me) {
      return;
    }
    const methods = listUnlockMethods(me.vault_slots);
    setStep({ kind: "unlock", methods });
  }, [me, status, vaultSetupInProgress, vaultStatus]);

  useEffect(() => {
    if (status !== "authenticated" || vaultStatus !== "unlocked") {
      return;
    }
    navigate(getPostLoginPath(location), { replace: true });
  }, [location, navigate, status, vaultStatus]);

  const mfaBearerToken = useMemo(() => {
    if (step.kind === "enroll" || step.kind === "verify") {
      return step.multifactorToken;
    }
    return null;
  }, [step]);

  const getMfaBearerToken = useCallback(async () => {
    if (!mfaBearerToken) {
      throw new Error("MFA session expired.");
    }
    return mfaBearerToken;
  }, [mfaBearerToken]);

  const unlockMethods = useMemo(() => {
    if (step.kind === "unlock") {
      return step.methods;
    }
    if (!me) {
      return [] as UnlockMethod[];
    }
    return listUnlockMethods(me.vault_slots);
  }, [me, step]);

  const finishingSignIn = status === "authenticated" && vaultSetupInProgress;
  const showVaultUnlock =
    status === "authenticated" && vaultStatus === "locked" && !vaultSetupInProgress && me !== null;
  const showVaultSetup =
    status === "authenticated" && vaultStatus === "none" && !vaultSetupInProgress && me !== null;
  const cardSize =
    step.kind === "enroll" || showVaultUnlock || showVaultSetup ? "content" : "fixed";

  if (status === "loading") {
    return <LoginCardSkeleton />;
  }

  function resetToCredentials(options?: { clearPassword?: boolean }) {
    setStep({ kind: "credentials" });
    if (options?.clearPassword) {
      setPassword("");
    }
    setErrorMessages([]);
  }

  async function finishAuth(result: MfaVerifyComplete) {
    setSubmitting(true);
    try {
      const unlockResult = await completeLoginWithPassword(result.tokens, password, {
        webauthn: result.webauthn,
      });
      if (unlockResult.kind === "manual_required") {
        setStep({ kind: "unlock", methods: unlockResult.methods });
      }
      setErrorMessages([]);
    } catch (error) {
      setErrorMessages([errorMessage(error, "Could not complete sign-in. Please try again.")]);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEnrollmentComplete(tokens: TokenPair | null) {
    if (tokens) {
      await finishAuth({ tokens });
      pushNotification("Multi-factor authentication is enabled.", "success");
      return;
    }
    resetToCredentials({ clearPassword: true });
    pushNotification(MFA_ENROLLMENT_SUCCESS_MESSAGE, "success");
  }

  async function handleVerifyComplete(result: MfaVerifyComplete) {
    await finishAuth(result);
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessages([]);

    const trimmedUsername = username.trim();
    if (!trimmedUsername || !password) {
      setErrorMessages(["Username and password are required."]);
      return;
    }

    setSubmitting(true);
    try {
      const result = await login(trimmedUsername, password);
      if (result.kind === "multifactor_enrollment_required") {
        setErrorMessages([]);
        setStep({
          kind: "enroll",
          multifactorToken: result.multifactorToken,
          methods: result.methods,
        });
        return;
      }
      if (result.kind === "multifactor_required") {
        setErrorMessages([]);
        setStep({
          kind: "verify",
          multifactorToken: result.multifactorToken,
          methods: result.methods,
        });
        return;
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setErrorMessages(["Invalid username or password."]);
        return;
      }
      setErrorMessages([errorMessage(error, "Could not sign in. Please try again.")]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {errorMessages.length > 0 ? <FormErrorSummary title="" messages={errorMessages} /> : null}

      <LoginCard size={cardSize}>
        <LoginStepContent
          step={step}
          showVaultUnlock={showVaultUnlock}
          showVaultSetup={showVaultSetup}
          finishingSignIn={finishingSignIn}
          me={me}
          unlockMethods={unlockMethods}
          getMfaBearerToken={getMfaBearerToken}
          username={username}
          password={password}
          submitting={submitting}
          onUsernameChange={setUsername}
          onPasswordChange={setPassword}
          onCredentialsSubmit={handleSubmit}
          onEnrollmentComplete={(tokens) => {
            void handleEnrollmentComplete(tokens);
          }}
          onVerifyComplete={(result) => {
            void handleVerifyComplete(result);
          }}
          onEnrollCancel={() => resetToCredentials()}
          onVerifyCancel={() => resetToCredentials({ clearPassword: true })}
          onVaultUnlockComplete={() => setErrorMessages([])}
          onVaultSetupComplete={() => setErrorMessages([])}
          onVaultErrorMessagesChange={setErrorMessages}
        />
      </LoginCard>
    </div>
  );
}
