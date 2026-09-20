import type { CardCatalog } from "@ndb/platform";
import defaultEmptyIllustration from "@web/assets/images/illustrations/empty.svg";
import { PrimaryButton } from "@web/components/Button";
import { CatalogMatrixCellPill } from "@web/components/CreditCards/CatalogMatrixCellPill";
import { CatalogSlotDetail } from "@web/components/CreditCards/CatalogSlotDetail";
import { MatrixLinkCell } from "@web/components/CreditCards/MatrixLinkCell";
import { MatrixToggleChipRow } from "@web/components/CreditCards/MatrixToggleChipRow";
import { StatusView } from "@web/components/Layout/StatusView";
import { Dialog } from "@web/components/Modal/Dialog";
import { formatBankName } from "@web/utils/banks";
import {
  annualFeeDetailSupplement,
  CATALOG_EM_DASH,
  catalogLegalDisclaimer,
  dedupeCatalogSources,
  resolveSlotSourceUrl,
} from "@web/utils/credit-cards/display";
import { uniqueBanks } from "@web/utils/credit-cards/filters";
import {
  buildMatrixRows,
  distinctGroupLabels,
  filterMatrixRows,
  MATRIX_SECTION_IDS,
  type MatrixBenefitRow,
  type MatrixCell,
  type MatrixRow,
  type MatrixSectionId,
  sectionLabel,
  visibleMatrixBenefitRows,
} from "@web/utils/credit-cards/matrix";
import type { CreditCardsHubQuery } from "@web/utils/credit-cards/query";
import {
  excludedBanksSet,
  excludedSectionsSet,
  invertExcluded,
  matrixColumnAnchorId,
  matrixRowAnchorId,
  toggleInList,
} from "@web/utils/credit-cards/query";
import { type ReactNode, useEffect, useMemo, useState } from "react";

type CreditCardMatrixProps = {
  catalogs: CardCatalog[];
  hubQuery: CreditCardsHubQuery;
  onHubQueryChange: (query: CreditCardsHubQuery) => void;
};

type DetailDialogState = {
  title: string;
  fieldLabel: string;
  cell: MatrixCell;
  catalog: CardCatalog;
};

type SourcesDialogState = {
  catalog: CardCatalog;
};

const sectionItems = MATRIX_SECTION_IDS.map((id) => ({
  id,
  label: sectionLabel(id),
}));

export function Matrix({ catalogs, hubQuery, onHubQueryChange }: CreditCardMatrixProps) {
  const [detailDialog, setDetailDialog] = useState<DetailDialogState | null>(null);
  const [sourcesDialog, setSourcesDialog] = useState<SourcesDialogState | null>(null);

  const excludedSections = excludedSectionsSet(hubQuery);
  const excludedBanks = excludedBanksSet(hubQuery);
  const showParserFallback = hubQuery.parserFallback ?? false;

  const banks = useMemo(
    () =>
      uniqueBanks(
        catalogs.map((c) => ({
          registry_key: c.registry_key,
          display_name: c.display_name,
          bank: c.bank,
          variant: c.variant,
          default_kind: c.default_kind,
          reward_kind: c.reward_kind,
          tags: c.tags,
        }))
      ),
    [catalogs]
  );

  const bankItems = useMemo(
    () => banks.map((bank) => ({ id: bank, label: formatBankName(bank) })),
    [banks]
  );

  const cardColumns = useMemo(() => {
    const built = buildMatrixRows(catalogs);
    return filterMatrixRows(built, {
      showParserFallback,
      excludedBanks,
    });
  }, [catalogs, showParserFallback, excludedBanks]);

  const benefitRows = useMemo(
    () => visibleMatrixBenefitRows({ excludedSections }),
    [excludedSections]
  );

  const showGroupHeaders = distinctGroupLabels(benefitRows).length > 1;

  const allSectionsHidden = excludedSections.size >= MATRIX_SECTION_IDS.length;
  const allBanksHidden = banks.length > 0 && excludedBanks.size >= banks.length;
  const showMatrixTable = !allSectionsHidden && !allBanksHidden && cardColumns.length > 0;

  useEffect(() => {
    if (!hubQuery.card) {
      return;
    }
    if (cardColumns.length === 0) {
      return;
    }
    const id = matrixColumnAnchorId(hubQuery.card);
    document
      .getElementById(id)
      ?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [hubQuery.card, cardColumns.length]);

  function patchQuery(patch: Partial<CreditCardsHubQuery>) {
    onHubQueryChange({ ...hubQuery, ...patch });
  }

  function toggleSection(sectionId: MatrixSectionId) {
    const next = toggleInList(hubQuery.excludeSections, sectionId);
    patchQuery({ excludeSections: next.length > 0 ? next : undefined });
  }

  function toggleBank(bank: string) {
    const next = toggleInList(hubQuery.excludeBanks, bank);
    patchQuery({ excludeBanks: next.length > 0 ? next : undefined });
  }

  function invertSections() {
    const next = invertExcluded(MATRIX_SECTION_IDS, excludedSections);
    patchQuery({ excludeSections: next.length > 0 ? next : undefined });
  }

  function invertBanks() {
    const next = invertExcluded(banks, excludedBanks);
    patchQuery({ excludeBanks: next.length > 0 ? next : undefined });
  }

  function handleSlotCellClick(rowCatalog: CardCatalog, cell: MatrixCell) {
    if (cell.status === "NA" || cell.compact === CATALOG_EM_DASH) {
      return;
    }
    setDetailDialog({
      title: rowCatalog.display_name,
      fieldLabel: cell.fieldLabel,
      cell,
      catalog: rowCatalog,
    });
  }

  return (
    <section className="space-y-4" aria-labelledby="credit-card-matrix-heading">
      <h2 id="credit-card-matrix-heading" className="sr-only">
        Card comparison table
      </h2>

      <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-3">
        <MatrixToggleChipRow
          label="Sections"
          items={sectionItems}
          excluded={excludedSections}
          onToggle={(id) => toggleSection(id as MatrixSectionId)}
          onInvert={invertSections}
          invertAriaLabel="Invert visible sections"
        />
        <MatrixToggleChipRow
          label="Banks"
          items={bankItems}
          excluded={excludedBanks}
          onToggle={toggleBank}
          onInvert={invertBanks}
          invertAriaLabel="Invert visible banks"
          trailing={
            <button
              type="button"
              aria-pressed={showParserFallback}
              className={
                showParserFallback ? "segment-tab-active" : "segment-tab matrix-chip-excluded"
              }
              onClick={() => patchQuery({ parserFallback: !showParserFallback || undefined })}
            >
              Generic profiles
            </button>
          }
        />
      </div>

      {showMatrixTable ? (
        <p className="text-sm text-slate-600">
          {cardColumns.length} card{cardColumns.length === 1 ? "" : "s"} · {benefitRows.length}{" "}
          benefit row{benefitRows.length === 1 ? "" : "s"}
        </p>
      ) : null}

      <MatrixOutcome
        allSectionsHidden={allSectionsHidden}
        allBanksHidden={allBanksHidden}
        cardColumns={cardColumns}
        bodyRows={benefitBodyRows({
          benefitRows,
          showGroupHeaders,
          cardColumns,
          onSlotClick: handleSlotCellClick,
          onShowSources: (catalog) => setSourcesDialog({ catalog }),
        })}
        onShowAllSections={() => patchQuery({ excludeSections: undefined })}
        onShowAllBanks={() => patchQuery({ excludeBanks: undefined })}
      />

      <p className="text-xs leading-relaxed text-slate-500">{catalogLegalDisclaimer()}</p>

      <MatrixDialogs
        detailDialog={detailDialog}
        sourcesDialog={sourcesDialog}
        onCloseDetail={() => setDetailDialog(null)}
        onCloseSources={() => setSourcesDialog(null)}
      />
    </section>
  );
}

function benefitBodyRows({
  benefitRows,
  showGroupHeaders,
  cardColumns,
  onSlotClick,
  onShowSources,
}: {
  benefitRows: MatrixBenefitRow[];
  showGroupHeaders: boolean;
  cardColumns: MatrixRow[];
  onSlotClick: (catalog: CardCatalog, cell: MatrixCell) => void;
  onShowSources: (catalog: CardCatalog) => void;
}): ReactNode[] {
  const elements: ReactNode[] = [];
  let lastGroup: string | null = null;
  for (const benefit of benefitRows) {
    if (showGroupHeaders && benefit.groupLabel !== lastGroup) {
      lastGroup = benefit.groupLabel;
      elements.push(
        <tr key={`group-${benefit.groupId}`} className="catalog-matrix-group-row">
          <th scope="row" className="catalog-matrix-sticky-benefit px-4 text-left">
            {benefit.groupLabel}
          </th>
          <td colSpan={Math.max(cardColumns.length, 1)} aria-hidden />
        </tr>
      );
    }
    elements.push(
      <BenefitMatrixRow
        key={benefit.id}
        benefit={benefit}
        cardColumns={cardColumns}
        onSlotClick={onSlotClick}
        onShowSources={onShowSources}
      />
    );
  }
  return elements;
}

function BenefitMatrixRow({
  benefit,
  cardColumns,
  onSlotClick,
  onShowSources,
}: {
  benefit: MatrixBenefitRow;
  cardColumns: MatrixRow[];
  onSlotClick: (catalog: CardCatalog, cell: MatrixCell) => void;
  onShowSources: (catalog: CardCatalog) => void;
}) {
  return (
    <tr id={matrixRowAnchorId(benefit.id)} className="catalog-matrix-row">
      <th
        scope="row"
        className="catalog-matrix-sticky-benefit border-b border-slate-100 px-4 py-2 text-left text-sm font-medium text-slate-800"
      >
        {benefit.label}
      </th>
      {cardColumns.map((card) => (
        <td
          key={card.listItem.registry_key}
          className="border-b border-slate-100 px-2 py-2 text-center align-middle"
        >
          <BenefitMatrixCell
            benefit={benefit}
            card={card}
            onSlotClick={onSlotClick}
            onShowSources={onShowSources}
          />
        </td>
      ))}
    </tr>
  );
}

function BenefitMatrixCell({
  benefit,
  card,
  onSlotClick,
  onShowSources,
}: {
  benefit: MatrixBenefitRow;
  card: MatrixRow;
  onSlotClick: (catalog: CardCatalog, cell: MatrixCell) => void;
  onShowSources: (catalog: CardCatalog) => void;
}) {
  if (benefit.kind !== "slot") {
    return <MatrixLinkCell column={benefit} catalog={card.catalog} onShowSources={onShowSources} />;
  }
  const cell = card.cells[benefit.id];
  if (!cell) {
    return null;
  }
  return (
    <CatalogMatrixCellPill
      status={cell.status}
      compact={cell.compact}
      ariaLabel={`${cell.fieldLabel}: ${cell.slot.summary}`}
      onClick={() => onSlotClick(card.catalog, cell)}
    />
  );
}

function MatrixOutcome({
  allSectionsHidden,
  allBanksHidden,
  cardColumns,
  bodyRows,
  onShowAllSections,
  onShowAllBanks,
}: {
  allSectionsHidden: boolean;
  allBanksHidden: boolean;
  cardColumns: MatrixRow[];
  bodyRows: ReactNode;
  onShowAllSections: () => void;
  onShowAllBanks: () => void;
}) {
  if (allSectionsHidden) {
    return (
      <StatusView
        illustration={defaultEmptyIllustration}
        title="No sections selected"
        message="Turn on at least one section in the filter above to see benefit rows in the comparison table."
        actions={
          <PrimaryButton type="button" onClick={onShowAllSections}>
            Show all sections
          </PrimaryButton>
        }
      />
    );
  }
  if (allBanksHidden) {
    return (
      <StatusView
        illustration={defaultEmptyIllustration}
        title="No banks selected"
        message="Turn on at least one bank in the filter above to see cards in the comparison table."
        actions={
          <PrimaryButton type="button" onClick={onShowAllBanks}>
            Show all banks
          </PrimaryButton>
        }
      />
    );
  }
  if (cardColumns.length === 0) {
    return (
      <StatusView
        illustration={defaultEmptyIllustration}
        title="No cards match"
        message="Try showing more banks, enabling generic profiles, or clearing other filters."
      />
    );
  }
  return (
    <div className="catalog-matrix-scroll overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="catalog-matrix-table">
        <thead>
          <tr>
            <th
              scope="col"
              className="catalog-matrix-sticky-corner border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Benefit
            </th>
            {cardColumns.map((card) => (
              <th
                key={card.listItem.registry_key}
                id={matrixColumnAnchorId(card.listItem.registry_key)}
                scope="col"
                className="catalog-matrix-sticky-card-header border-b border-slate-200 px-2 py-3 text-left"
              >
                <p className="text-xs font-semibold leading-snug text-slate-900">
                  {card.listItem.display_name}
                </p>
                <p className="mt-0.5 text-[10px] font-normal text-slate-500">
                  {formatBankName(card.listItem.bank)}
                </p>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{bodyRows}</tbody>
      </table>
    </div>
  );
}

function MatrixDialogs({
  detailDialog,
  sourcesDialog,
  onCloseDetail,
  onCloseSources,
}: {
  detailDialog: DetailDialogState | null;
  sourcesDialog: SourcesDialogState | null;
  onCloseDetail: () => void;
  onCloseSources: () => void;
}) {
  return (
    <>
      <Dialog
        open={detailDialog !== null}
        onClose={onCloseDetail}
        title={detailDialog?.title ?? ""}
        size="lg"
      >
        {detailDialog ? (
          <CatalogSlotDetail
            fieldLabel={detailDialog.fieldLabel}
            slot={detailDialog.cell.slot}
            sourceUrl={resolveSlotSourceUrl(detailDialog.catalog, detailDialog.cell.slot)}
            {...annualFeeDetailSupplement(detailDialog.catalog, detailDialog.cell.path)}
          />
        ) : null}
      </Dialog>
      <Dialog
        open={sourcesDialog !== null}
        onClose={onCloseSources}
        title={sourcesDialog?.catalog.display_name ?? "Sources"}
        size="md"
      >
        {sourcesDialog ? <MatrixSourceList catalog={sourcesDialog.catalog} /> : null}
      </Dialog>
    </>
  );
}

function MatrixSourceList({ catalog }: { catalog: CardCatalog }) {
  return (
    <ul className="space-y-2 text-sm">
      {dedupeCatalogSources(catalog).map((source) => (
        <li key={source.url}>
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-blue-700 hover:underline"
          >
            {source.label}
          </a>
          <span className="text-slate-500"> · retrieved {source.retrieved_at}</span>
        </li>
      ))}
    </ul>
  );
}
