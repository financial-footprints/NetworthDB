import { type CSSProperties, type ReactNode, useEffect, useId, useRef } from "react";
import { LuInfo } from "react-icons/lu";

type HoverPopoverProps = {
  ariaLabel: string;
  children: ReactNode;
};

function useAnchorName() {
  const id = useId().replace(/:/g, "");
  return `--hover-popover-${id}`;
}

export function HoverPopover({ ariaLabel, children }: HoverPopoverProps) {
  const tooltipId = useId();
  const anchorName = useAnchorName();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearCloseTimer() {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function openPopover() {
    clearCloseTimer();
    const panel = panelRef.current;
    if (panel && !panel.matches(":popover-open")) {
      panel.showPopover();
    }
  }

  function scheduleClose() {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      const panel = panelRef.current;
      if (panel?.matches(":popover-open")) {
        panel.hidePopover();
      }
    }, 100);
  }

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const triggerStyle = {
    anchorName,
  } as CSSProperties;

  const panelStyle = {
    positionAnchor: anchorName,
  } as CSSProperties;

  return (
    <>
      <button
        type="button"
        tabIndex={-1}
        aria-label={ariaLabel}
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        style={triggerStyle}
        onMouseEnter={openPopover}
        onMouseLeave={scheduleClose}
        onFocus={openPopover}
        onBlur={scheduleClose}
      >
        <LuInfo className="size-3.5" strokeWidth={2} aria-hidden />
      </button>
      <div
        ref={panelRef}
        id={tooltipId}
        popover="manual"
        role="tooltip"
        aria-label={ariaLabel}
        className="hover-popover-panel pointer-events-auto rounded-sm border border-slate-200 bg-white px-4 py-3.5 text-left text-sm leading-relaxed text-slate-700 shadow-lg"
        style={panelStyle}
        onMouseEnter={openPopover}
        onMouseLeave={scheduleClose}
      >
        {children}
      </div>
    </>
  );
}
