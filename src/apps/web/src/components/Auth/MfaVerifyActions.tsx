import { PrimaryButton, SecondaryButton } from "@web/components/Button";

type MfaVerifyPrimaryAction = {
  label: string;
  submittingLabel?: string;
  submitting?: boolean;
  type?: "submit" | "button";
  onClick?: () => void;
};

type MfaVerifyActionsProps = {
  onBack?: () => void;
  backLabel?: string;
  backDisabled?: boolean;
  className?: string;
  primary?: MfaVerifyPrimaryAction;
};

export function MfaVerifyActions({
  onBack,
  backLabel = "Back",
  backDisabled = false,
  className = "mt-auto flex justify-end gap-2",
  primary,
}: MfaVerifyActionsProps) {
  return (
    <div className={className}>
      {onBack ? (
        <SecondaryButton type="button" onClick={onBack} disabled={backDisabled}>
          {backLabel}
        </SecondaryButton>
      ) : null}
      {primary ? (
        <PrimaryButton
          type={primary.type ?? "submit"}
          onClick={primary.onClick}
          disabled={primary.submitting}
          aria-busy={primary.submitting}
        >
          {primary.submitting ? (primary.submittingLabel ?? primary.label) : primary.label}
        </PrimaryButton>
      ) : null}
    </div>
  );
}
