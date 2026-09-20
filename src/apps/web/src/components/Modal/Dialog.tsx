import type { ReactNode } from "react";
import { useEffect, useId } from "react";
import { LuX } from "react-icons/lu";

type DialogSize = "sm" | "md" | "lg" | "xl";

const SIZE_CLASS: Record<DialogSize, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-6xl",
};

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: DialogSize;
  busy?: boolean;
  panelClassName?: string;
  stacked?: boolean;
};

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
  busy = false,
  panelClassName,
  stacked = false,
}: DialogProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, onClose, open]);

  if (!open) {
    return null;
  }

  const panel =
    panelClassName ??
    `relative w-full ${SIZE_CLASS[size]} rounded-sm bg-white p-5 shadow-xl max-h-[90vh] overflow-y-auto`;

  return (
    <div
      className={`dialog-overlay fixed inset-0 flex items-center justify-center p-4${stacked ? " dialog-overlay-stacked" : ""}`}
    >
      <button
        type="button"
        className="dialog-backdrop absolute inset-0 bg-slate-900/50"
        aria-label="Close"
        onClick={() => {
          if (!busy) {
            onClose();
          }
        }}
      />
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className={panel}>
        <header className="mb-4 flex items-start justify-between gap-3">
          <h2
            id={titleId}
            className="flex min-w-0 flex-1 items-center gap-1.5 text-base font-semibold text-slate-900"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex size-8 shrink-0 items-center justify-center rounded-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
            aria-label="Close"
          >
            <LuX className="size-4" strokeWidth={1.5} aria-hidden />
          </button>
        </header>
        {children}
        {footer ? (
          <footer className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-4">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
