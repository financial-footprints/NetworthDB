import { mapCreateUserError } from "@web/components/Auth/helpers";
import { PrimaryButton, SecondaryButton } from "@web/components/Button";
import { FormErrorSummary } from "@web/components/Fields/FormErrorSummary";
import { FormRow } from "@web/components/Fields/FormRow";
import { PasswordInput } from "@web/components/Fields/PasswordInput";
import { useNotifications } from "@web/contexts/Notifications/Context";
import { StackedModalShell } from "@web/contexts/Settings/components/StackedModalShell";
import { registerUser } from "@web/utils/api/routes/auth";
import { type SubmitEvent, useEffect, useState } from "react";

const ROLE_OPTIONS = [
  { value: "user", label: "User" },
  { value: "manager", label: "Manager" },
  { value: "administrator", label: "Administrator" },
] as const;

type CreateUserModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
};

function validateCreateUserForm(
  username: string,
  password: string,
  confirmPassword: string
): string | null {
  const trimmedUsername = username.trim();
  if (!trimmedUsername) {
    return "Username is required.";
  }
  if (!password) {
    return "Password is required.";
  }
  if (password !== confirmPassword) {
    return "Passwords do not match.";
  }
  return null;
}

export function CreateUserModal({ isOpen, onClose, onCreated }: CreateUserModalProps) {
  const { pushNotification } = useNotifications();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<string>("user");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setUsername("");
      setPassword("");
      setConfirmPassword("");
      setRole("user");
      setErrorMessages([]);
      setSubmitting(false);
    }
  }, [isOpen]);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessages([]);

    const validationError = validateCreateUserForm(username, password, confirmPassword);
    if (validationError) {
      setErrorMessages([validationError]);
      return;
    }

    setSubmitting(true);
    try {
      await registerUser({
        username: username.trim(),
        password,
        role,
      });
      pushNotification("User created", "success");
      onCreated();
      onClose();
    } catch (error) {
      setErrorMessages([mapCreateUserError(error)]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <StackedModalShell
      isOpen={isOpen}
      title="Create user"
      busy={submitting}
      onClose={onClose}
      description="Set a username and password for the new account. Share the password with them offline."
      panelClassName="relative w-full max-w-md rounded-sm bg-white p-6 shadow-xl"
    >
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <FormErrorSummary messages={errorMessages} />

        <FormRow
          label="Username"
          htmlFor="create-user-username"
          required
          encryptionKind="server_plain"
        >
          <input
            id="create-user-username"
            type="text"
            className="form-input"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            disabled={submitting}
            autoComplete="off"
          />
        </FormRow>

        <FormRow label="Password" htmlFor="create-user-password" required>
          <PasswordInput
            encryptionKind="server_hashed"
            id="create-user-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={submitting}
            autoComplete="new-password"
            revealLabel="password"
          />
        </FormRow>

        <FormRow label="Confirm Password" htmlFor="create-user-confirm-password" required>
          <PasswordInput
            id="create-user-confirm-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            disabled={submitting}
            autoComplete="new-password"
            revealLabel="confirmed password"
          />
        </FormRow>

        <FormRow label="Role" htmlFor="create-user-role" required>
          <select
            id="create-user-role"
            className="form-input"
            value={role}
            onChange={(event) => setRole(event.target.value)}
            disabled={submitting}
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FormRow>

        <div className="flex justify-end gap-2">
          <SecondaryButton type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </SecondaryButton>
          <PrimaryButton type="submit" disabled={submitting} aria-busy={submitting}>
            {submitting ? "Creating…" : "Create"}
          </PrimaryButton>
        </div>
      </form>
    </StackedModalShell>
  );
}
