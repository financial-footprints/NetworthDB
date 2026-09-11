import { DangerButton } from "@web/components/button";

type VaultSlotRowProps = {
  title: string;
  subtitle: string;
  showRemove: boolean;
  manageDisabled: boolean;
  onRemove: () => void;
};

export function VaultSlotRow({
  title,
  subtitle,
  showRemove,
  manageDisabled,
  onRemove,
}: VaultSlotRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-sm border border-slate-200 bg-white px-3 py-2">
      <div className="min-w-0 space-y-0.5">
        <p className="truncate text-sm font-medium text-slate-800">{title}</p>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
      {showRemove ? (
        <DangerButton type="button" onClick={onRemove} disabled={manageDisabled}>
          Remove
        </DangerButton>
      ) : null}
    </div>
  );
}
