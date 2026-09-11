import type { AriaAttributes, ReactNode } from "react";

type DangerButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  variant?: "outline" | "solid";
  "aria-busy"?: AriaAttributes["aria-busy"];
};

export function DangerButton({
  children,
  onClick,
  disabled,
  type = "button",
  variant = "outline",
  "aria-busy": ariaBusy,
}: DangerButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-busy={ariaBusy}
      className={variant === "solid" ? "btn-danger-solid" : "btn-danger-outline"}
    >
      {children}
    </button>
  );
}
