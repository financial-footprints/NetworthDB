import type { CatalogSlot } from "@ndb/platform";
import { CatalogStatusChip } from "@web/components/CreditCards/CatalogStatusChip";
import { confidenceLabel } from "@web/utils/credit-cards/labels";

type CatalogSlotDetailProps = {
  fieldLabel: string;
  slot: CatalogSlot;
  supplementalLabel?: string;
  supplementalSlot?: CatalogSlot;
  sourceUrl?: string | null;
};

function ConditionsList({ conditions }: { conditions: CatalogSlot["conditions"] }) {
  if (!conditions?.length) {
    return null;
  }
  return (
    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
      {conditions.map((condition) => (
        <li key={`${condition.type}:${condition.summary}`}>{condition.summary}</li>
      ))}
    </ul>
  );
}

function SlotBody({ fieldLabel, slot }: { fieldLabel: string; slot: CatalogSlot }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-800">{fieldLabel}</span>
        <CatalogStatusChip status={slot.status} />
      </div>
      <p className="text-sm text-slate-700">{slot.summary}</p>
      <ConditionsList conditions={slot.conditions} />
      {slot.notes ? <p className="text-sm text-slate-500">{slot.notes}</p> : null}
      <p className="text-xs text-slate-500">{confidenceLabel(slot.confidence)}</p>
    </div>
  );
}

export function CatalogSlotDetail({
  fieldLabel,
  slot,
  supplementalLabel,
  supplementalSlot,
  sourceUrl,
}: CatalogSlotDetailProps) {
  return (
    <div className="space-y-4 rounded-md bg-slate-50 px-4 py-3">
      <SlotBody fieldLabel={fieldLabel} slot={slot} />
      {supplementalSlot && supplementalLabel ? (
        <div className="border-t border-slate-200 pt-4">
          <SlotBody fieldLabel={supplementalLabel} slot={supplementalSlot} />
        </div>
      ) : null}
      {sourceUrl ? (
        <p className="border-t border-slate-200 pt-4 text-sm">
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-blue-700 hover:underline"
          >
            View source
          </a>
        </p>
      ) : null}
    </div>
  );
}
