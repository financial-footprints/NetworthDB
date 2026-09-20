import { SecondaryButton } from "@web/components/Button";
import { FormRow } from "@web/components/Fields/FormRow";
import { Search } from "@web/components/List/Search";
import type {
  AmountFilterMode,
  PartyPickerOption,
} from "@web/routes/accounts/details/_parts/ledger/query";
import type { CategoryApi } from "@web/utils/api/routes/categories/types";
import type { TagApi } from "@web/utils/api/routes/tags/types";
import { useId, useState } from "react";
import { LuChevronDown, LuChevronUp } from "react-icons/lu";

type TransactionLedgerFiltersProps = {
  descriptionInput: string;
  onDescriptionInputChange: (value: string) => void;
  sourceAccountId: string;
  onSourceAccountIdChange: (value: string) => void;
  destinationAccountId: string;
  onDestinationAccountIdChange: (value: string) => void;
  categoryId: string;
  onCategoryIdChange: (value: string) => void;
  tagId: string;
  onTagIdChange: (value: string) => void;
  amountMode: AmountFilterMode;
  onAmountModeChange: (mode: AmountFilterMode) => void;
  amountMinInput: string;
  onAmountMinInputChange: (value: string) => void;
  amountMaxInput: string;
  onAmountMaxInputChange: (value: string) => void;
  partyOptions: PartyPickerOption[];
  rootCategories: CategoryApi[];
  allTags: TagApi[];
  filtersActive: boolean;
  activeFilterCount: number;
  onClearFilters: () => void;
};

export function Filters({
  descriptionInput,
  onDescriptionInputChange,
  sourceAccountId,
  onSourceAccountIdChange,
  destinationAccountId,
  onDestinationAccountIdChange,
  categoryId,
  onCategoryIdChange,
  tagId,
  onTagIdChange,
  amountMode,
  onAmountModeChange,
  amountMinInput,
  onAmountMinInputChange,
  amountMaxInput,
  onAmountMaxInputChange,
  partyOptions,
  rootCategories,
  allTags,
  filtersActive,
  activeFilterCount,
  onClearFilters,
}: TransactionLedgerFiltersProps) {
  const [expanded, setExpanded] = useState(false);
  const fromId = useId();
  const toId = useId();
  const categoryFieldId = useId();
  const tagFieldId = useId();
  const amountModeId = useId();
  const amountMinId = useId();
  const amountMaxId = useId();

  return (
    <div className="ledger-filter-panel">
      <div className="ledger-filter-toolbar">
        <Search
          value={descriptionInput}
          placeholder="Search By Description"
          onChange={onDescriptionInputChange}
        />
        <SecondaryButton
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
          className="shrink-0"
        >
          {expanded ? (
            <LuChevronUp className="size-4" strokeWidth={2} aria-hidden />
          ) : (
            <LuChevronDown className="size-4" strokeWidth={2} aria-hidden />
          )}
          Filters
          {activeFilterCount > 0 ? (
            <span className="ledger-filter-badge">{activeFilterCount}</span>
          ) : null}
        </SecondaryButton>
        {filtersActive ? (
          <button
            type="button"
            className="ledger-filter-clear shrink-0 text-sm font-medium text-[#1a5fb4] hover:underline"
            onClick={onClearFilters}
          >
            Clear Filters
          </button>
        ) : null}
      </div>

      {expanded ? (
        <div className="ledger-filter-advanced space-y-3">
          <FormRow label="From" htmlFor={fromId}>
            <select
              id={fromId}
              className="form-input w-full"
              value={sourceAccountId}
              onChange={(event) => onSourceAccountIdChange(event.target.value)}
            >
              <option value="">All</option>
              {partyOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="To" htmlFor={toId}>
            <select
              id={toId}
              className="form-input w-full"
              value={destinationAccountId}
              onChange={(event) => onDestinationAccountIdChange(event.target.value)}
            >
              <option value="">All</option>
              {partyOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Category" htmlFor={categoryFieldId}>
            <select
              id={categoryFieldId}
              className="form-input w-full"
              value={categoryId}
              onChange={(event) => onCategoryIdChange(event.target.value)}
            >
              <option value="">All</option>
              {rootCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Tag" htmlFor={tagFieldId}>
            <select
              id={tagFieldId}
              className="form-input w-full"
              value={tagId}
              onChange={(event) => onTagIdChange(event.target.value)}
            >
              <option value="">All</option>
              {allTags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Amount" htmlFor={amountModeId}>
            <select
              id={amountModeId}
              className="form-input w-full"
              value={amountMode}
              onChange={(event) => onAmountModeChange(event.target.value as AmountFilterMode)}
            >
              <option value="any">Any</option>
              <option value="min">At Least</option>
              <option value="max">At Most</option>
              <option value="between">Between</option>
            </select>
          </FormRow>
          {amountMode === "min" || amountMode === "between" ? (
            <FormRow
              label={amountMode === "between" ? "Minimum (₹)" : "Amount (₹)"}
              htmlFor={amountMinId}
            >
              <input
                id={amountMinId}
                type="text"
                className="form-input w-full"
                placeholder="0.00"
                value={amountMinInput}
                onChange={(event) => onAmountMinInputChange(event.target.value)}
                autoComplete="off"
              />
            </FormRow>
          ) : null}
          {amountMode === "max" ? (
            <FormRow label="Amount (₹)" htmlFor={amountMaxId}>
              <input
                id={amountMaxId}
                type="text"
                className="form-input w-full"
                placeholder="0.00"
                value={amountMaxInput}
                onChange={(event) => onAmountMaxInputChange(event.target.value)}
                autoComplete="off"
              />
            </FormRow>
          ) : null}
          {amountMode === "between" ? (
            <FormRow label="Maximum (₹)" htmlFor={amountMaxId}>
              <input
                id={amountMaxId}
                type="text"
                className="form-input w-full"
                placeholder="0.00"
                value={amountMaxInput}
                onChange={(event) => onAmountMaxInputChange(event.target.value)}
                autoComplete="off"
              />
            </FormRow>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
