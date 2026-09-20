import type { AriaAttributes, ReactNode } from "react";

type SecondaryButtonProps = {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  "aria-busy"?: AriaAttributes["aria-busy"];
  title?: string;
  type?: "button" | "submit" | "reset";
};

export function SecondaryButton({
  children,
  className,
  onClick,
  disabled,
  title,
  type = "button",
  "aria-busy": ariaBusy,
}: SecondaryButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-busy={ariaBusy}
      title={title}
      className={className ? `btn-secondary ${className}` : "btn-secondary"}
    >
      {children}
    </button>
  );
}
