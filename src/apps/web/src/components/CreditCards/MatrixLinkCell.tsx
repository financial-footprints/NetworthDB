/// <reference types="react" />

import type { CardCatalog } from "@ndb/platform";
import { CATALOG_EM_DASH, dedupeCatalogSources } from "@web/utils/credit-cards/display";
import type { MatrixLinkBenefitRow } from "@web/utils/credit-cards/matrix";
import { FaExternalLinkAlt } from "react-icons/fa";

type MatrixLinkCellProps = {
  column: MatrixLinkBenefitRow;
  catalog: CardCatalog;
  onShowSources: (catalog: CardCatalog) => void;
};

export function MatrixLinkCell({ column, catalog, onShowSources }: MatrixLinkCellProps) {
  if (column.kind === "mitc") {
    const url = catalog.mitc_url;
    if (!url) {
      return <span className="text-slate-400">{CATALOG_EM_DASH}</span>;
    }
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="catalog-matrix-pill catalog-matrix-pill-link inline-flex items-center gap-1 no-underline"
      >
        Open
        <FaExternalLinkAlt className="size-3 opacity-70" aria-hidden />
      </a>
    );
  }

  if (column.kind === "product") {
    const url = catalog.official_product_url;
    if (!url) {
      return <span className="text-slate-400">{CATALOG_EM_DASH}</span>;
    }
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="catalog-matrix-pill catalog-matrix-pill-link inline-flex items-center gap-1 no-underline"
      >
        Open
        <FaExternalLinkAlt className="size-3 opacity-70" aria-hidden />
      </a>
    );
  }

  const sources = dedupeCatalogSources(catalog);
  if (sources.length === 0) {
    return <span className="text-slate-400">{CATALOG_EM_DASH}</span>;
  }

  return (
    <button
      type="button"
      className="catalog-matrix-pill catalog-matrix-pill-link"
      onClick={() => onShowSources(catalog)}
    >
      {sources.length} source{sources.length === 1 ? "" : "s"}
    </button>
  );
}
