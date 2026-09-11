import { HoverPopover } from "@web/components/popover";
import { STACKED_OVERLAY_Z } from "@web/utils/constant";
import { type ReactNode, useEffect, useId } from "react";
import { LuX } from "react-icons/lu";

type StackedModalShellProps = {
  isOpen: boolean;
  title: string;
  busy?: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Help text shown in a HoverPopover next to the title. */
  description?: ReactNode;
  /** Plain subtitle under the title (not a popover). */
  subtitle?: string;
  panelClassName?: string;
};

export function StackedModalShell({
  isOpen,
  title,
  busy = false,
  onClose,
  children,
  description,
  subtitle,
  panelClassName = "relative w-full max-w-md rounded-sm bg-white p-5 shadow-xl",
}: StackedModalShellProps) {
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className={`fixed inset-0 ${STACKED_OVERLAY_Z} flex items-center justify-center p-4`}>
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50"
        aria-label="Close"
        onClick={() => {
          if (!busy) {
            onClose();
          }
        }}
      />
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className={panelClassName}>
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <h3 id={titleId} className="text-base font-semibold text-slate-900">
                {title}
              </h3>
              {description ? (
                <HoverPopover ariaLabel={`About ${title}`}>{description}</HoverPopover>
              ) : null}
            </div>
            {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
          </div>
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
      </div>
    </div>
  );
}
