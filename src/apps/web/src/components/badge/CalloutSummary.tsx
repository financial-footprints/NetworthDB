import type { ReactNode } from "react";
import { LuInfo, LuTriangleAlert } from "react-icons/lu";

type CalloutVariant = "info" | "warning";

type CalloutSummaryProps = {
  variant: CalloutVariant;
  children: ReactNode;
  className?: string;
};

const VARIANT_STYLES: Record<
  CalloutVariant,
  {
    border: string;
    bar: string;
    icon: string;
    text: string;
    Icon: typeof LuInfo;
  }
> = {
  info: {
    border: "border-blue-200",
    bar: "bg-blue-500",
    icon: "text-blue-600",
    text: "text-slate-700",
    Icon: LuInfo,
  },
  warning: {
    border: "border-amber-200",
    bar: "bg-amber-500",
    icon: "text-amber-600",
    text: "text-amber-950",
    Icon: LuTriangleAlert,
  },
};

export function CalloutSummary({ variant, children, className = "" }: CalloutSummaryProps) {
  const styles = VARIANT_STYLES[variant];
  const Icon = styles.Icon;

  return (
    <output
      className={`flex overflow-hidden rounded-sm border bg-white shadow-sm ${styles.border} ${className}`}
    >
      <div className={`w-1 shrink-0 ${styles.bar}`} aria-hidden />
      <div className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5">
        <Icon className={`size-4 shrink-0 ${styles.icon}`} strokeWidth={2} aria-hidden />
        <div className={`min-w-0 text-sm leading-relaxed ${styles.text}`}>{children}</div>
      </div>
    </output>
  );
}
