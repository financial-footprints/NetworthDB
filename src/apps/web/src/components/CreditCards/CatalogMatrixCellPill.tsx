import type { SlotStatus } from "@ndb/platform";
import { CATALOG_EM_DASH, formatMatrixPillLabel } from "@web/utils/credit-cards/display";

const PILL_BASE = "catalog-matrix-pill";

const STATUS_PILL_CLASS: Partial<Record<SlotStatus, string>> = {
  unknown: "catalog-matrix-pill-unknown",
  depends: "catalog-matrix-pill-depends",
  conditional: "catalog-matrix-pill-conditional",
  yes: "catalog-matrix-pill-yes",
};

type CatalogMatrixCellPillProps = {
  status: SlotStatus;
  compact: string;
  onClick: () => void;
  ariaLabel?: string;
};

export function CatalogMatrixCellPill({
  status,
  compact,
  onClick,
  ariaLabel,
}: CatalogMatrixCellPillProps) {
  if (status === "NA" || compact === CATALOG_EM_DASH) {
    return <span className="text-slate-400">{CATALOG_EM_DASH}</span>;
  }

  const label = formatMatrixPillLabel(status, compact);
  const statusClass = STATUS_PILL_CLASS[status] ?? "catalog-matrix-pill-default";

  return (
    <button
      type="button"
      className={`${PILL_BASE} ${statusClass}`}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {label}
    </button>
  );
}
