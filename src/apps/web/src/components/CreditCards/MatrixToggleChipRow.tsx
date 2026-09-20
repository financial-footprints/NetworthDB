import { IconActionButton } from "@web/components/Button";
import type { ReactNode } from "react";
import { LuArrowLeftRight } from "react-icons/lu";

type MatrixToggleChipItem = {
  id: string;
  label: string;
};

type MatrixToggleChipRowProps = {
  label: string;
  items: MatrixToggleChipItem[];
  excluded: Set<string>;
  onToggle: (id: string) => void;
  onInvert?: () => void;
  invertAriaLabel?: string;
  trailing?: ReactNode;
};

export function MatrixToggleChipRow({
  label,
  items,
  excluded,
  onToggle,
  onInvert,
  invertAriaLabel,
  trailing,
}: MatrixToggleChipRowProps) {
  return (
    <div className="catalog-matrix-filter-row">
      <span className="catalog-matrix-filter-label">{label}</span>
      <div className="flex min-w-0 flex-wrap gap-1">
        {items.map((item) => {
          const isVisible = !excluded.has(item.id);
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={isVisible}
              className={isVisible ? "segment-tab-active" : "segment-tab matrix-chip-excluded"}
              onClick={() => onToggle(item.id)}
            >
              {item.label}
            </button>
          );
        })}
        {trailing}
      </div>
      {onInvert ? (
        <IconActionButton
          onClick={onInvert}
          title={invertAriaLabel ?? `Invert ${label.toLowerCase()} selection`}
          tone="neutral"
        >
          <LuArrowLeftRight className="size-4" strokeWidth={1.75} aria-hidden />
        </IconActionButton>
      ) : null}
    </div>
  );
}
