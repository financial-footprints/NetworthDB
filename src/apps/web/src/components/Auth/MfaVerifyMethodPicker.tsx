import { formatMfaMethodLabel, type MfaVerifyMethod } from "@web/components/Auth/helpers";

type MfaVerifyMethodPickerProps = {
  options: MfaVerifyMethod[];
  onSelect: (method: MfaVerifyMethod) => void;
};

export function MfaVerifyMethodPicker({ options, onSelect }: MfaVerifyMethodPickerProps) {
  return (
    <ul className="divide-y divide-slate-100">
      {options.map((method) => (
        <li key={method}>
          <button
            type="button"
            onClick={() => onSelect(method)}
            className="flex w-full items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-[#1a5fb4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a5fb4]/40"
          >
            <span>{formatMfaMethodLabel(method)}</span>
            <span className="shrink-0 text-slate-400" aria-hidden>
              ›
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
