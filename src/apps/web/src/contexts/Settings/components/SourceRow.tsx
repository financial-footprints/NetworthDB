import { ConfirmDeleteButton } from "@web/components/Button";
import type { SourceConfig } from "@web/utils/api/routes/sources/types";

function sourceDisplayName(source: SourceConfig): string {
  const label = source.label.trim();
  if (label) {
    return label;
  }
  return source.type === "thunderbird" ? "Thunderbird Profile" : "Email Inbox";
}

function sourceTypeLabel(source: SourceConfig): string {
  return source.type === "thunderbird" ? "Thunderbird" : "Email";
}

type SourceRowProps = {
  source: SourceConfig;
  disabled?: boolean;
  onEdit: () => void;
  onRemove: () => Promise<void>;
};

export function SourceRow({ source, disabled = false, onEdit, onRemove }: SourceRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-sm border border-slate-200 bg-white px-3 py-2">
      <button
        type="button"
        className="min-w-0 flex-1 space-y-0.5 text-left"
        onClick={onEdit}
        disabled={disabled}
      >
        <p className="truncate text-sm font-medium text-slate-800">{sourceDisplayName(source)}</p>
        <p className="text-xs text-slate-500">{sourceTypeLabel(source)}</p>
      </button>
      <ConfirmDeleteButton
        confirmMessage={`Remove statement source ${sourceDisplayName(source)}?`}
        label="Remove"
        loadingLabel="Removing…"
        disabled={disabled}
        onDelete={onRemove}
        errorMessage="Could not remove statement source."
      />
    </div>
  );
}
