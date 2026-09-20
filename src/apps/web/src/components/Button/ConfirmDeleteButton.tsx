import { IconActionButton } from "@web/components/Button/IconActionButton";
import { SecondaryButton } from "@web/components/Button/SecondaryButton";
import { useNotifications } from "@web/contexts/Notifications/Context";
import { errorMessage } from "@web/utils/errors";
import { useState } from "react";
import { FaTrash } from "react-icons/fa";
import { LuTrash2 } from "react-icons/lu";

type ConfirmDeleteButtonProps = {
  confirmMessage: string;
  onDelete: () => Promise<void>;
  onSuccess?: () => void;
  errorMessage?: string;
  variant?: "default" | "danger" | "icon";
  label?: string;
  loadingLabel?: string;
  title?: string;
  disabled?: boolean;
};

export function ConfirmDeleteButton({
  confirmMessage,
  onDelete,
  onSuccess,
  errorMessage: errorMessageText = "Could not complete delete.",
  variant = "default",
  label = "Delete",
  loadingLabel = "Deleting…",
  title = "Delete",
  disabled = false,
}: ConfirmDeleteButtonProps) {
  const { pushNotification } = useNotifications();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (deleting) {
      return;
    }
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setDeleting(true);
    try {
      await onDelete();
      onSuccess?.();
    } catch (error) {
      pushNotification(errorMessage(error, errorMessageText), "error");
    } finally {
      setDeleting(false);
    }
  }

  if (variant === "icon") {
    return (
      <IconActionButton
        onClick={() => void handleDelete()}
        disabled={disabled || deleting}
        aria-busy={deleting}
        tone="danger"
        title={deleting ? loadingLabel : title}
      >
        <LuTrash2 className="size-4" strokeWidth={2} aria-hidden />
      </IconActionButton>
    );
  }

  if (variant === "danger") {
    return (
      <button
        type="button"
        onClick={() => void handleDelete()}
        disabled={disabled || deleting}
        aria-busy={deleting}
        title={title}
        className="btn-danger-outline gap-2"
      >
        <FaTrash className="size-3.5 shrink-0" aria-hidden />
        {deleting ? loadingLabel : label}
      </button>
    );
  }

  return (
    <SecondaryButton
      type="button"
      onClick={() => void handleDelete()}
      disabled={disabled || deleting}
      aria-busy={deleting}
      title={title}
    >
      <FaTrash aria-hidden />
      {deleting ? loadingLabel : label}
    </SecondaryButton>
  );
}
