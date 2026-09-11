import { FaSpinner } from "react-icons/fa";

type ChipProps = {
  label: string;
  title: string;
  available: boolean;
  uploading: boolean;
  onClick: () => void;
};

export function Chip({ label, title, available, uploading, onClick }: ChipProps) {
  return (
    <button
      type="button"
      disabled={uploading}
      aria-busy={uploading}
      onClick={onClick}
      className={[
        "rounded-xs px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition",
        uploading
          ? "cursor-wait bg-slate-100 text-slate-400 ring-1 ring-slate-200"
          : available
            ? "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-900 hover:text-white hover:ring-slate-900"
            : "bg-amber-50 text-amber-800 ring-1 ring-amber-300 hover:bg-amber-100",
      ].join(" ")}
      title={title}
    >
      <span className="relative inline-block">
        <span className={uploading ? "invisible" : undefined}>{label}</span>
        {uploading ? (
          <FaSpinner
            className="absolute left-1/2 top-1/2 size-[1em] -translate-x-1/2 -translate-y-1/2 animate-spin"
            aria-hidden
          />
        ) : null}
      </span>
    </button>
  );
}
