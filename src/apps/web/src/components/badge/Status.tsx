type StatusProps = {
  label: string;
  className?: string;
  pulse?: boolean;
};

export function Status({ label, className = "", pulse = false }: StatusProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${className} ${pulse ? "animate-pulse" : ""}`}
    >
      {label}
    </span>
  );
}
