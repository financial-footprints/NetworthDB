import { PrimaryButton, SecondaryButton } from "@web/components/Button";
import { FormErrorSummary } from "@web/components/Fields/FormErrorSummary";
import { StackedModalShell } from "@web/contexts/Settings/components/StackedModalShell";
import { e2eeFieldToggleCopy } from "@web/utils/crypto/rewrite";

type EncryptionFieldToggleModalProps = {
  isOpen: boolean;
  fieldLabel: string;
  enable: boolean;
  submitting: boolean;
  errorMessages: string[];
  onClose: () => void;
  onConfirm: () => void;
};

export function Toggle({
  isOpen,
  fieldLabel,
  enable,
  submitting,
  errorMessages,
  onClose,
  onConfirm,
}: EncryptionFieldToggleModalProps) {
  const copy = e2eeFieldToggleCopy(fieldLabel, enable);

  return (
    <StackedModalShell
      isOpen={isOpen}
      title={copy.title}
      subtitle={copy.body}
      busy={submitting}
      onClose={onClose}
    >
      <div className="space-y-4">
        <FormErrorSummary messages={errorMessages} />
        <div className="flex justify-end gap-2">
          <SecondaryButton type="button" disabled={submitting} onClick={onClose}>
            Cancel
          </SecondaryButton>
          <PrimaryButton type="button" disabled={submitting} onClick={onConfirm}>
            {copy.confirmLabel}
          </PrimaryButton>
        </div>
      </div>
    </StackedModalShell>
  );
}
