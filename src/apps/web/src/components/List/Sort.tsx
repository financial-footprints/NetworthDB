import { SecondaryButton } from "@web/components/Button";
import type { SortDirection, SortState } from "@web/utils/list";
import { FaSortAmountDown, FaSortAmountUp } from "react-icons/fa";

type ListSortControlsProps<TField extends string> = {
  options: readonly { field: TField; label: string }[];
  sort: SortState<TField>;
  onSortFieldChange: (field: TField) => void;
  onSortDirectionChange: (direction: SortDirection) => void;
};

export function Sort<TField extends string>({
  options,
  sort,
  onSortFieldChange,
  onSortDirectionChange,
}: ListSortControlsProps<TField>) {
  const nextDirection = sort.direction === "asc" ? "desc" : "asc";

  return (
    <div className="flex items-center gap-2">
      <label className="sr-only" htmlFor="list-sort-field">
        Sort By
      </label>
      <select
        id="list-sort-field"
        className="form-input w-auto min-w-[8rem]"
        value={sort.field}
        onChange={(event) => onSortFieldChange(event.target.value as TField)}
      >
        {options.map((option) => (
          <option key={option.field} value={option.field}>
            {option.label}
          </option>
        ))}
      </select>
      <SecondaryButton
        type="button"
        aria-label="Sort Direction"
        title={sort.direction === "asc" ? "Ascending" : "Descending"}
        onClick={() => onSortDirectionChange(nextDirection)}
      >
        {sort.direction === "asc" ? (
          <FaSortAmountUp aria-hidden />
        ) : (
          <FaSortAmountDown aria-hidden />
        )}
      </SecondaryButton>
    </div>
  );
}
