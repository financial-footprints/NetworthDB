import { Chip } from "@web/components/badge/Chip";
import type { StatementFormat } from "@web/utils/api/endpoints/accounts/types";

export type MonthTileChip = {
  format: StatementFormat;
  available: boolean;
  title: string;
  uploading: boolean;
  onClick: () => void;
};

type MonthTileProps = {
  label: string;
  cellClassName: string;
  chips: MonthTileChip[];
};

export function MonthTile({ label, cellClassName, chips }: MonthTileProps) {
  return (
    <div
      className={["flex min-h-16 flex-col gap-1.5 rounded-sm px-1.5 py-2", cellClassName].join(" ")}
    >
      <div className="flex w-full items-start justify-between gap-1">
        <span className="text-xs font-medium sm:text-sm">{label}</span>
      </div>
      {chips.length > 0 ? (
        <div className="flex flex-wrap justify-center gap-1">
          {chips.map((chip) => (
            <Chip
              key={chip.format}
              label={chip.format}
              title={chip.title}
              available={chip.available}
              uploading={chip.uploading}
              onClick={chip.onClick}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
