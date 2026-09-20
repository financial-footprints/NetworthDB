import type { AriaAttributes, ReactNode } from "react";

type IconActionTone = "neutral" | "edit" | "danger";

const ICON_ACTION_TONES: Record<IconActionTone, string> = {
  neutral: "text-slate-400 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-600",
  edit: "text-blue-500/80 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600",
  danger: "text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600",
};

const iconActionButtonBaseClassName =
  "flex size-8 shrink-0 items-center justify-center rounded-sm border border-transparent transition disabled:cursor-not-allowed disabled:opacity-50";

type IconActionButtonProps = {
  children: ReactNode;
  onClick: () => void;
  title: string;
  tone?: IconActionTone;
  disabled?: boolean;
  "aria-busy"?: AriaAttributes["aria-busy"];
};

export function IconActionButton({
  children,
  onClick,
  title,
  tone = "neutral",
  disabled,
  "aria-busy": ariaBusy,
}: IconActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={ariaBusy}
      aria-label={title}
      title={title}
      className={`${iconActionButtonBaseClassName} ${ICON_ACTION_TONES[tone]}`}
    >
      {children}
    </button>
  );
}
