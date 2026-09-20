import { LoginCard } from "@web/components/Auth/LoginCard";
import { PrimaryButton } from "@web/components/Button";
import { FormErrorSummary } from "@web/components/Fields/FormErrorSummary";
import { FormRow } from "@web/components/Fields/FormRow";
import { PageTitle } from "@web/components/Layout/PageTitle";
import { path } from "@web/router/routes";
import { beginAdvancedRecovery, beginPasswordReset } from "@web/utils/api/routes/auth/recovery";
import { errorMessage } from "@web/utils/errors";
import { type SubmitEvent, useState } from "react";
import { Link } from "react-router-dom";

type RecoveryKind = "password" | "advanced";

const RECOVERY_SUCCESS_MESSAGE =
  "If an account exists for those details, you'll receive recovery instructions by email.";

export default function RecoveryRequestPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [kind, setKind] = useState<RecoveryKind>("password");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessages([]);

    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();
    if (!trimmedUsername || !trimmedEmail) {
      setErrorMessages(["Username and recovery email are required."]);
      return;
    }

    setSubmitting(true);
    try {
      if (kind === "password") {
        await beginPasswordReset(trimmedUsername, trimmedEmail);
      } else {
        await beginAdvancedRecovery(trimmedUsername, trimmedEmail);
      }
      setSubmitted(true);
    } catch (error) {
      setErrorMessages([errorMessage(error, "Could not start recovery. Please try again.")]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <PageTitle page="Account Recovery" />

      {errorMessages.length > 0 ? <FormErrorSummary title="" messages={errorMessages} /> : null}

      <LoginCard size={submitted ? "content" : "fixed"}>
        {submitted ? (
          <div className="flex min-h-0 flex-1 flex-col justify-center gap-4">
            <h1 className="text-base font-semibold text-slate-900">Check your email</h1>
            <p className="text-sm text-slate-600">{RECOVERY_SUCCESS_MESSAGE}</p>
            <div className="pt-2">
              <Link
                to={path.login}
                className="text-sm font-medium text-[#1a5fb4] hover:text-[#1557a0]"
              >
                Back to login
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col justify-center">
            <form className="space-y-5" onSubmit={handleSubmit} noValidate>
              <div>
                <h1 className="text-base font-semibold text-slate-900">Recover your account</h1>
                <p className="mt-1 text-sm text-slate-600">
                  Enter your username and recovery email address.
                </p>
              </div>

              <FormRow label="Recovery Type" htmlFor="recovery-kind" required>
                <select
                  id="recovery-kind"
                  value={kind}
                  onChange={(event) => setKind(event.target.value as RecoveryKind)}
                  disabled={submitting}
                  className="form-input"
                >
                  <option value="password">Reset Password</option>
                  <option value="advanced">Advanced Recovery (Vault Phrase)</option>
                </select>
              </FormRow>

              <FormRow label="Username" htmlFor="recovery-username" required>
                <input
                  id="recovery-username"
                  type="text"
                  name="username"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  disabled={submitting}
                  className="form-input"
                />
              </FormRow>

              <FormRow label="Recovery Email" htmlFor="recovery-email" required>
                <input
                  id="recovery-email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={submitting}
                  className="form-input"
                />
              </FormRow>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <Link
                  to={path.login}
                  className="text-sm font-medium text-slate-500 hover:text-slate-900"
                >
                  Back to login
                </Link>
                <PrimaryButton type="submit" disabled={submitting} aria-busy={submitting}>
                  {submitting ? "Sending…" : "Send recovery email"}
                </PrimaryButton>
              </div>
            </form>
          </div>
        )}
      </LoginCard>
    </div>
  );
}
