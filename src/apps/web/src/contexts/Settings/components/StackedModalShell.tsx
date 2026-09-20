import { Dialog } from "@web/components/Modal/Dialog";
import { Hover } from "@web/components/Popover/Hover";
import type { ReactNode } from "react";

type StackedModalShellProps = {
  isOpen: boolean;
  title: string;
  busy?: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Help text shown beside the title. */
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
  const titleNode = description ? (
    <span className="inline-flex items-center gap-2">
      {title}
      <Hover ariaLabel={`About ${title}`}>{description}</Hover>
    </span>
  ) : (
    title
  );

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title={titleNode}
      busy={busy}
      size="sm"
      stacked
      panelClassName={panelClassName}
    >
      {subtitle ? <p className="-mt-2 mb-4 text-sm text-slate-500">{subtitle}</p> : null}
      {children}
    </Dialog>
  );
}
